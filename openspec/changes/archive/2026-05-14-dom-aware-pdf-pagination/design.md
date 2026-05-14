## 上下文

当前 PDF 导出流程：`html2canvas` 将整个 `.report-root` 截为长图 → `jsPDF` 按固定 A4 高度等分切片。这种"均匀切片"方式完全不感知内容块位置，导致内容（文字、表格、卡片）在页面边界被腰切。

本变更仅改动 [exportReport.js](src/utils/exportReport.js) 的切片逻辑，不改动渲染模板、CSS 样式或依赖项。

## 目标 / 非目标

**目标：**
- PDF 页面分割点始终落在内容块之间的空白间隙处，而非内容块内部
- 保持现有视觉样式不变（边距、字体、颜色等）
- 不引入新依赖

**非目标：**
- 不解决单块内容超过 A4 高度的截断（降级为均匀切片）
- 不改变报告模板内容结构
- 不引入 html2pdf.js 等 HTML-to-PDF 替代方案

## 决策

### 决策 1：保留 html2canvas + jsPDF 方案，在切片阶段加入 DOM 测量

**理由：** 已有依赖、渲染结果成熟、风险最低。替代方案（如 html2pdf.js 或 @react-pdf）需引入新依赖且重新验证渲染效果。

**实现方式：**

1. **DOM 标记** — 模板中给所有需要"块级保护"的元素统一标记 class `.pdf-block`。目前 `.report-block`、`.timeline-item` 已有 `page-break-inside: avoid`，但部分块（`.decision-summary`、`.stress-test`、`.stress-details`、`.disclaimer`）无标记。

2. **DOM 测量** — 在 `html2canvas` 截图前，确保容器 `scrollTop = 0`（避免滚动偏移影响），然后用 `getBoundingClientRect()` 获取所有 `.pdf-block` 相对于 `.report-root` 的 Y 坐标，得到一组 `{top, bottom, height}` 数组。为减少回流（Reflow），一次性读取 `offsetTop` / `offsetHeight` 而非逐次查询 `getBoundingClientRect()`。

3. **坐标映射** — 将 DOM 像素坐标按比例映射到 Canvas 像素坐标。使用宽度比（而非高度比）作为缩放因子，避免高度受内容换行等因素导致的测量误差：
   ```
   y_canvas = (y_dom - y_root_top) × (W_canvas / W_dom)
   ```
   其中 `y_root_top` 是 `.report-root` 容器顶部相对于视口的 Y 坐标（测量前已强制 `scrollTop = 0`，该值通常为 0），`W_canvas = canvas.width`（已包含 `scale: 2`），`W_dom = rootEl.offsetWidth`。

4. **分页算法** — 从 Canvas 顶部开始，每页的目标行 = `currentPage × A4_canvas_height`。在目标行附近（±20px）扫描 `.pdf-block` 间隙列表，选择最接近且不超过目标行的间隙作为实际截断点。

5. **超长块降级** — 如果某块高度 > A4_canvas_height，则在其内部的 A4 边界处强制截断（无法避免截断）。

6. **最后一页处理** — 当剩余内容不足一页时，按实际内容高度裁剪 Canvas 区域，不足部分自然留白，不填充。jsPDF 的 `addImage` 按实际截取的 Canvas 高度渲染，页面底部空白为正常行为。

### 决策 2：间隙扫描容差设为 ±20px（DOM 坐标）

**理由：** 太大会跳过多个间隙导致页面留白过多，太小可能在无间隙时无法找到截断点。20px 约等于 5-6mm，对于报告块间距（12-20px）而言是合理的容差。

### 决策 3：使用 `overflow: visible` 替代固定 `min-height: 297mm`

**理由：** 当前模板每节设 `min-height: 297mm`，目的是让截图结果足够高。但 DOM 感知分页不再依赖固定高度，改为自然高度即可。不过为保持 PDF 输出视觉一致，保留 `min-height` 作为最小高度。

## 风险 / 权衡

| 风险 | 缓解措施 |
|---|---|
| DOM 坐标映射比例误差导致截断点偏移 | 使用 `offsetHeight` 而非 CSS `height`，确保比例精确 |
| 块间距过小（<2px）时容差找不到间隙 | 容差回退到固定 A4 切割（降级行为） |
| `getBoundingClientRect` 在离屏容器中可能不准 | 确保容器 `display: block`、`visibility: hidden` 而非 `display: none` |
| 超长内容块跨页截断仍然不完美 | 接受降级，此类情况本就罕见 |
| 容器存在滚动条导致 `getBoundingClientRect` 偏移 | 测量前强制 `scrollTop = 0`，确保从顶部开始测量 |
| 图片/图表未加载完成导致 DOM 高度不准确 | 截图前等待所有图片和 ECharts 渲染完成 |
| `margin-top/bottom` 塌陷导致测量尺寸小于视觉边缘 | 检查 `.pdf-block` 的 margin 表现，必要时改用 `padding` 替代 |
| DOM 节点极多时 `measureBlocks` 产生短暂阻塞 | 一次性读取 `offsetTop`/`offsetHeight` 减少回流，避免逐次查询 |
