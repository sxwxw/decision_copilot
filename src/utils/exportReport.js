import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** 间隙扫描容差（DOM 像素，约 5-6mm） */
const GAP_TOLERANCE = 20

/**
 * 测量所有 .pdf-block 相对于根容器的位置，返回间隙列表。
 * 使用 offsetTop/offsetHeight 一次性读取，减少回流。
 */
function measureBlocks(rootEl) {
  const blocks = rootEl.querySelectorAll('.pdf-block')
  if (!blocks.length) return { blocks: [], gaps: [] }

  const result = []
  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i]
    const top = el.offsetTop
    const height = el.offsetHeight
    result.push({ top, bottom: top + height, height })
  }

  // 排序（DOM 顺序即渲染顺序，但防御一下）
  result.sort((a, b) => a.top - b.top)

  // 计算间隙：块与块之间的空白区域
  const gaps = []
  for (let i = 1; i < result.length; i++) {
    const gapTop = result[i - 1].bottom
    const gapBottom = result[i].top
    if (gapBottom > gapTop) {
      gaps.push({ top: gapTop, bottom: gapBottom, center: (gapTop + gapBottom) / 2 })
    }
  }

  return { blocks: result, gaps }
}

/**
 * DOM 坐标 → Canvas 坐标映射。
 * 使用宽度比作为缩放因子（宽度固定 210mm，不受内容换行影响）。
 */
function mapToCanvas(domY, canvasWidth, domWidth) {
  const scale = canvasWidth / domWidth
  return domY * scale
}

/**
 * 计算 DOM 感知分页的截断点列表。
 * 返回每个页面对应的 Canvas Y 坐标。
 * 如果无法使用 DOM 感知分页，返回 null。
 */
function computeBreakPoints(rootEl, canvas, pdfPageHeightPx) {
  const { blocks, gaps } = measureBlocks(rootEl)

  // 如果无块可测量，回退到均匀切片
  if (!blocks.length || !gaps.length) {
    return null
  }

  const canvasWidth = canvas.width
  const domWidth = rootEl.offsetWidth
  const canvasHeight = canvas.height
  const mapFn = (domY) => mapToCanvas(domY, canvasWidth, domWidth)
  const toleranceCanvas = GAP_TOLERANCE * (canvasWidth / domWidth)

  // 将间隙映射到 canvas 坐标
  const gapsCanvas = gaps.map(g => ({
    top: mapFn(g.top),
    bottom: mapFn(g.bottom),
    center: mapFn(g.center),
  }))

  // 计算内容总高度（canvas 像素）
  const contentHeight = mapFn(blocks[blocks.length - 1].bottom)
  const totalPages = Math.ceil(contentHeight / pdfPageHeightPx)

  const breakPoints = [0] // 第一页从 0 开始

  for (let page = 1; page < totalPages; page++) {
    const targetBottom = page * pdfPageHeightPx

    // 检查目标位置是否落在某个块内部（超长块）
    let inOversizedBlock = false
    for (const block of blocks) {
      const blockCanvasTop = mapFn(block.top)
      const blockCanvasBottom = mapFn(block.bottom)
      if ((blockCanvasBottom - blockCanvasTop) > pdfPageHeightPx &&
          targetBottom > blockCanvasTop && targetBottom < blockCanvasBottom) {
        inOversizedBlock = true
        break
      }
    }

    if (inOversizedBlock) {
      // 超长块内部，强制在目标位置截断
      breakPoints.push(targetBottom)
      continue
    }

    // 在目标位置附近找最佳间隙（tolerance 范围内最接近的）
    let bestGap = null
    let bestDist = Infinity

    for (const gap of gapsCanvas) {
      const dist = Math.abs(gap.center - targetBottom)
      if (dist <= toleranceCanvas && dist < bestDist) {
        bestDist = dist
        bestGap = gap
      }
    }

    if (bestGap) {
      // 使用间隙中心作为截断点
      breakPoints.push(bestGap.center)
    } else {
      // 容差回退：固定 A4 切割
      breakPoints.push(targetBottom)
    }
  }

  return breakPoints
}

/**
 * 截取 canvas 区域并添加到 PDF 页面。
 * 当 slice 高度足够填满一页时，拉伸填满（与原行为一致）；
 * 当不足一页时，按实际比例渲染，底部自然留白。
 */
function addPageToPdf(canvas, pdf, yOffset, sliceHeight, pdfWidth, pdfHeight) {
  const pageCanvas = document.createElement('canvas')
  pageCanvas.width = canvas.width
  pageCanvas.height = sliceHeight
  const ctx = pageCanvas.getContext('2d')
  ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

  // 整页内容：拉伸填满 A4 高度（与原行为一致）；不足一页：按比例渲染
  const renderedHeight = sliceHeight >= pdfHeight ? pdfHeight : (sliceHeight / canvas.width) * pdfWidth
  pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, renderedHeight)
}

/**
 * 将离屏报告 DOM 导出为 PDF 并触发下载。
 * 策略：DOM 感知分页 — 在内容块之间的空白间隙处截断，避免内容被腰切。
 */
export async function exportReportToPdf(containerEl, options = {}) {
  const {
    filename = `decision-report-${Date.now()}.pdf`,
    dpi = 2,
  } = options

  const rootEl = containerEl.querySelector('.report-root')
  if (!rootEl) {
    throw new Error('[ExportReport] 未找到 .report-root 容器')
  }

  // 确保从顶部开始测量（避免滚动偏移）
  rootEl.scrollTop = 0
  containerEl.scrollTop = 0

  // 截取整个报告为一张长图
  const canvas = await html2canvas(rootEl, {
    scale: dpi,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  // A4 页面对应的 canvas 像素高度
  const pageCanvasHeight = (canvas.width * pdfHeight) / pdfWidth

  // 内容总高度
  const contentHeight = canvas.height

  // 计算 DOM 感知分页截断点
  const breakPoints = computeBreakPoints(rootEl, canvas, pageCanvasHeight)

  // 如果无 breakPoints（无 .pdf-block 或无间隙），回退到均匀切片
  if (!breakPoints) {
    const totalPages = Math.ceil(contentHeight / pageCanvasHeight)
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()
      const yOffset = i * pageCanvasHeight
      const sliceHeight = Math.min(pageCanvasHeight, contentHeight - yOffset)
      addPageToPdf(canvas, pdf, yOffset, sliceHeight, pdfWidth, pdfHeight)
    }
  } else {
    // DOM 感知分页
    for (let i = 0; i < breakPoints.length; i++) {
      if (i > 0) pdf.addPage()

      const yOffset = breakPoints[i]
      const nextYOffset = i < breakPoints.length - 1 ? breakPoints[i + 1] : contentHeight
      const sliceHeight = Math.min(pageCanvasHeight, nextYOffset - yOffset)
      addPageToPdf(canvas, pdf, yOffset, sliceHeight, pdfWidth, pdfHeight)
    }
  }

  pdf.save(filename)
}
