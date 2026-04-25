# spec: report-quality

## 需求

### 报告视觉基调

- 系统 SHALL 在导出的 PDF 报告中使用"商务冷感"视觉风格
- 报告 SHALL 使用 A4 标准宽度 (210mm)，页边距 25mm
- 报告 SHALL 移除所有按钮、阴影和过渡动画
- 报告的容器、卡片、矩阵单元格 SHALL 统一使用直角（无圆角）
- 报告的文字颜色 SHALL 遵循：标题 `#000`，正文 `#333`，辅助信息 `#888`

### 推荐结论摘要（定音鼓）

- 报告 Section 1 SHALL 包含推荐方案摘要区，展示得分最高的方案
- 系统 SHALL 计算并展示"推荐置信度"（高/中/低），基于 Top1 与 Top2 的得分差
- 报告 SHALL 展示推荐方案的 AI 分析文本
- 报告 SHALL 在 Top1 与 Top2 得分接近时展示备选警示

### 参数配置表

- 报告 SHALL 展示当前所有参数维度的权重、当前值、默认值 (50)、偏移量

### 方案能力对比（CSS 条形图）

- 报告 SHALL 在 Section 1 底部包含方案能力对比区
- 系统 SHALL 使用 CSS 水平条形图（非 canvas）展示各方案在各维度上的表现
- 条形图 SHALL 使用不同深浅的灰色区分方案
- 条形的值 SHALL 基于公式 `50 + (paramValue - 50) * delta * 2 / 100` 计算

### 路径推演时间轴

- 报告 SHALL 在 Section 2 包含竖向时间轴，展示路径链的每个步骤
- 每个步骤 SHALL 展示：步骤编号、名称、得分、关键影响、风险状态
- 步骤的风险状态 SHALL 基于 threshold 缺口判定：无缺口 = 安全，1 个缺口 = 警告，2+ 缺口 = 高风险

### 安全边际表

- 报告 SHALL 在路径推演下方包含安全边际表
- 对路径上每个 threshold，系统 SHALL 计算 margin = currentValue - threshold
- margin > 15 SHALL 标记为"稳健 (Robust)"，>5 SHALL 标记为"紧平衡 (Tight)"，<=5 SHALL 标记为"脆弱 (Fragile)"
- 报告 SHALL 生成压力测试推论文案，描述最关键的边际情况

### 高风险 Step 深度解析

- 报告 SHALL 自动识别 margin 最低的 Step
- 报告 SHALL 展示瓶颈维度和最小 margin 值
- 报告 SHALL 生成对冲策略建议文本

### 归因矩阵

- 报告 Section 3 SHALL 包含归因矩阵（维度 x 选项交叉表）
- 每个单元格 SHALL 展示影响值 `impact = (paramValue - 50) * delta * 2 / 100`
- 每行中绝对值最大的单元格 SHALL 标记 `★`（决胜因子）
- 单元格 SHALL 根据正负偏移使用不同视觉样式

### 执行摘要

- 报告 SHALL 展示所有方案的排名对比表
- 报告 SHALL 展示 `recommendation.analysis` 和 `recommendation.delta_analysis` 文本

### 机会成本与免责声明

- 报告 SHALL 展示机会成本注脚
- 报告页脚 SHALL 包含免责声明
