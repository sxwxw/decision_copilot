## 修改需求

### 需求:5 步流水线

系统 SHALL 支持 5 步 Agent 流水线：FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS。后端 `/full-pipeline` 和 `/pipeline/:id/resume` 路由中的步骤列表 MUST 与前端 PipelineProgress 组件中定义的 5 步保持一致。

#### 场景:流水线逐步执行
- **当** 用户触发完整流水线
- **那么** 按顺序执行 FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS，每步完成后存储结果到 pipelineState
- **那么** SIMULATE 步骤为占位步骤，不调用 LLM，但发送 completed SSE 事件

#### 场景:断点续跑
- **当** 用户在流水线完成后请求断点续跑
- **那么** 从 `lastStep` 的下一个步骤开始，依次调用 LLM 执行剩余步骤
- **那么** 已完成的步骤不重新执行
- **那么** 所有步骤执行完成后发送 complete SSE 事件

#### 场景:断点续跑时 pipelineState 为空
- **当** 用户请求断点续跑但 pipelineState 中无缓存数据
- **那么** 返回 404 错误，提示流水线数据已丢失

### 需求:快速模式兼容

系统 SHALL 保留现有的单步 MODEL-BUILD 作为快速模式，不触发完整流水线。

#### 场景:快速模式
- **当** 用户提交问题但不选择"深度分析"
- **那么** 仅执行 MODEL-BUILD 步骤，返回决策模型
