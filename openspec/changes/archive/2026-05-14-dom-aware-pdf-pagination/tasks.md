## 1. DOM 标记

- [ ] 1.1 在 ReportTemplate.vue 中给 `.decision-summary`、`.stress-test`、`.stress-details`、`.disclaimer` 添加 `.pdf-block` class
- [ ] 1.2 检查现有 `.pdf-block` 的 `margin` 表现，确认无 `margin-top/bottom` 塌陷，必要时改用 `padding` 确保测量坐标包含完整视觉边缘

## 2. DOM 测量与坐标映射

- [ ] 2.1 在 exportReport.js 中实现 `measureBlocks` 函数：一次性读取 `offsetTop`/`offsetHeight` 减少回流，查询所有 `.pdf-block` 返回间隙列表
- [ ] 2.2 实现 DOM-to-Canvas 坐标映射函数，使用 `offsetHeight` 比例计算，确保 `scale: 2` 已纳入比例

## 3. DOM 感知分页算法

- [ ] 3.1 实现 `findPageBreakPoints` 函数：遍历 A4 高度位置，在附近 ±20px 扫描块间隙，选择最佳截断点
- [ ] 3.2 实现超长块降级逻辑：单块高度超过 A4 时，在块内按 A4 高度截断
- [ ] 3.3 实现容差回退逻辑：无可用间隙时回退到固定 A4 切割
- [ ] 3.4 实现最后一页处理：剩余内容不足一页时按实际高度裁剪，不强制补白

## 4. 前置条件与集成

- [ ] 4.1 确保所有媒体资源（图片、ECharts 图表）渲染完成后再触发测量与截图
- [ ] 4.2 测量前强制容器 `scrollTop = 0`，避免滚动偏移导致坐标错误

## 5. 集成与测试

- [ ] 5.1 将新分页算法集成到 `exportReportToPdf` 主函数，替换原有均匀切片逻辑
- [ ] 5.2 手动验证 PDF 导出：确认无内容截断、页边距一致、超长块降级正常、最后一页留白正确
