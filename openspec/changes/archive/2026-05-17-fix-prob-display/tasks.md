## 1. DecisionTree 组件改造

- [x] 1.1 新增 `paths` prop（类型 `Array`，默认 `[]`），接收 LLM 返回的 `paths` 数组
- [x] 1.2 实现 `resolveConditionalProb(node)` 函数：遍历 `node.pathIds`，在 `paths[].timeline` 中匹配 `event === node.name`，返回 `probability`
- [x] 1.3 连线标签渲染逻辑：step=1 返回空字符串，step>1 使用条件概率（`adjustedProbMap` 存在时优先取调整值）
- [x] 1.4 独立监听概率映射的 watch 回调中同步使用条件概率解析逻辑

## 2. DecisionView 数据传递

- [x] 2.1 DecisionView.vue 中将 `state.model.paths`（或 `state.paths`）传入 `<DecisionTree :paths="...">`
- [x] 2.2 确认 `useDecisionModel` 的 state 中已有 `paths` 数据可访问，如无则补充

## 3. 验证

- [x] 3.1 使用提供的示例数据启动服务，验证 step=1 连线无 P 标签
- [x] 3.2 验证 step>1 连线展示条件概率（如"出现严重故障"显示 P=30%）
- [x] 3.3 执行蒙特卡洛模拟后验证 `adjustedProbMap` 优先级正确
- [x] 3.4 验证 ForkComparison 卡片展示条件概率（"系统稳定运行" P=70%，"出现严重故障" P=30%）— 已改为直接取 `child.probability`
- [x] 3.5 验证 PathDetail 中"到达总概率"仍展示路径累积概率（不受影响）
