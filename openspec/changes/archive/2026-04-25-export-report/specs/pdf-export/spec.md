# spec: pdf-export

## 需求

### 导出依赖

- 系统 SHALL 使用 `html2canvas` 和 `jspdf` 作为 PDF 导出的核心依赖

### 导出按钮

- 系统 SHALL 在路径溯源视图底部提供"导出深度分析报告 (PDF)"按钮
- 导出按钮 SHALL 在导出期间处于禁用状态，并显示"导出中..."文本

### 离屏渲染

- 系统 SHALL 使用离屏容器 `#report-target` 渲染报告内容
- 系统 SHALL 使用 Vue 的 `h()` 和 `render()` API 动态渲染 `ReportTemplate` 组件到离屏容器
- 系统 SHALL 在截图前等待一个 `requestAnimationFrame` 以确保 DOM 渲染完成

### PDF 生成

- 系统 SHALL 使用 `html2canvas` 以 2x DPI 捕获报告内容
- 系统 SHALL 使用 `jsPDF` 创建 A4 纵向页面
- 系统 SHALL 将长 canvas 按 A4 高度比例切分为多页，使用 `ctx.drawImage` 截取每页区域
- 系统 SHALL 生成文件名 `decision-report-{timestamp}.pdf`

### 导出清理

- 系统 SHALL 在导出完成后清空离屏容器，避免内存泄漏
- 系统 SHALL 在导出失败时恢复按钮可用状态
