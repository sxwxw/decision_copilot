## 新增需求

### 需求:5 步流水线

系统 SHALL 支持 5 步 Agent 流水线：FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS。

#### 场景:流水线逐步执行
- **当** 用户触发完整流水线
- **那么** 按顺序执行 FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS，每步完成后存储结果到 pipelineState

#### 场景:断点续跑
- **当** 流水线在某步失败
- **那么** 用户可从失败的步骤重新开始，之前已完成的步骤不重新执行

### 需求:流水线进度 SSE 推送

系统 SHALL 在 `/full-pipeline` 路由中使用 SSE 推送每步进度。

#### 场景:SSE 推送步骤状态
- **当** 流水线执行到某一步
- **那么** 发送 SSE 事件：`{ step: <name>, status: "running" | "done" | "error", data: ... }`

#### 场景:前端展示进度
- **当** 前端收到 SSE 事件
- **那么** 更新对应步骤的状态展示（pending → running → done → error）

### 需求:快速模式兼容

系统 SHALL 保留现有的单步 MODEL-BUILD 作为快速模式，不触发完整流水线。

#### 场景:快速模式
- **当** 用户提交问题但不选择"深度分析"
- **那么** 仅执行 MODEL-BUILD 步骤，返回决策模型
