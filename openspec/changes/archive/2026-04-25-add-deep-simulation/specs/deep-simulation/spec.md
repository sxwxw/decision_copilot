# spec: deep-simulation

## 需求

### 深度模拟入口

- 系统 SHALL 在参数面板中提供"深度模拟"按钮
- 深度模拟按钮 SHALL 在参数偏离默认值 50 时呈现 primary 样式并触发呼吸动画
- 当单项参数偏离超过 40 时，按钮 SHALL 显示视觉提示（红点 + 灰色提示文字）

### 深度模拟后端

- 系统 SHALL 提供 `POST /api/decision/refine` 端点
- 该端点 SHALL 接收 `{ currentModel, paramValues, userInput }`
- 端点 SHALL 调用 LLM，使用专用的 refine prompt，开启思考模式
- refine prompt SHALL 要求 LLM 保持 options 列表和 variables 维度不变
- refine prompt SHALL 要求 LLM 返回完整的 model 结构
- refine prompt SHALL 要求 LLM 在 recommendation 中包含 `delta_analysis` 字段
- 端点 SHALL 在后端对返回数据进行清洗和验证

### 前端深度模拟流程

- 系统 SHALL 在点击深度模拟按钮时调用 `/refine` API
- 收到新 model 后，系统 SHALL 调用 `adaptTree` 适配树结构
- 系统 SHALL 记录 `snapshotWeights`，捕获当前参数值作为增量计算基准点
- 深度模拟 SHALL 重置选中节点并重新选中根节点
- 深度模拟 SHALL 重置反事实推演状态

### 增量分数计算

- 当存在 `snapshotWeights` 时，系统 SHALL 使用增量偏移公式计算分数：`shift = (currentValue - snapshotValue) / 100 × delta × 2`
- 当不存在 `snapshotWeights` 时，系统 SHALL 使用默认公式：`shift = (paramValue/100 - 0.5) × delta × 2`
- 最终分数 SHALL 限制在 0-100 范围内

### 归因展示

- 系统 SHALL 在方案概览区域展示 `recommendation.delta_analysis` 文案
- delta_analysis SHALL 使用 el-alert 组件展示在顶部
