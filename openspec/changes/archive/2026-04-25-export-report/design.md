# 设计：导出决策分析对比报告（PDF）

## 架构

```
用户点击「导出深度分析报告 (PDF)」
        │
        ▼
渲染 ReportTemplate 到离屏容器 #report-target
  h(ReportTemplate, { props }) → render(vnode, container)
        │
        ▼
等待 requestAnimationFrame（DOM 渲染完成）
        │
        ▼
html2canvas(container, { scale: 2 })
        │
        ▼
jsPDF 逐页切片（canvas.drawImage 按 A4 高度分割）
        │
        ▼
触发浏览器下载 decision-report-{timestamp}.pdf
```

## 关键决策

1. **离屏渲染**：使用 `h()` + `render()` 创建离屏 VNode，避免在视图中短暂闪烁
2. **html2canvas 参数**：`scale: 2` 保证 2x DPI 清晰度，`useCORS: true` 支持跨域资源
3. **分页策略**：单张长 canvas → 按 A4 高度比例切分为多页，使用 `ctx.drawImage` 截取区域
4. **清理**：导出完成后 `render(null, container)` 清空离屏容器，避免内存泄漏
