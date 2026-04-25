import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * 将离屏报告 DOM 导出为 PDF 并触发下载。
 * 策略：截取整个 report-root 为一张长图，再按 A4 高度比例切割成多页。
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

  // 每个 PDF 页面对应的图片像素高度
  const pageImgHeight = (canvas.width * pdfHeight) / pdfWidth
  const imgTotalHeight = canvas.height
  const totalPages = Math.ceil(imgTotalHeight / pageImgHeight)

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage()

    // 当前页截取的 Y 起始位置
    const yOffset = i * pageImgHeight
    // 最后一页可能不足一页
    const currentSliceHeight = Math.min(pageImgHeight, imgTotalHeight - yOffset)

    // 创建临时 canvas 截取当前页区域
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = currentSliceHeight
    const ctx = pageCanvas.getContext('2d')
    ctx.drawImage(
      canvas,
      0, yOffset, canvas.width, currentSliceHeight,  // 源区域
      0, 0, canvas.width, currentSliceHeight          // 目标区域
    )

    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight)
  }

  pdf.save(filename)
}
