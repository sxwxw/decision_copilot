# Spec: multi-agent-pipeline

## 修改需求

### 需求:Pipeline SSE 流管理

系统 SHALL 支持 SSE 流超时、取消、连接断开后的错误处理。

#### 场景:用户离开页面取消 Pipeline
- **当** 用户在 Pipeline 执行中导航离开
- **那么** SSE 流被 AbortController 终止，不继续占用资源

#### 场景:Pipeline 步骤间状态隔离
- **当** 多次 adaptTree 调用同时执行
- **那么** _idCounter 使用局部变量而非模块级全局变量，不产生 ID 碰撞

#### 场景:Pipeline resume 时保留 userInput
- **当** 调用 resumePipeline 端点
- **那么** resume 请求中包含原始 userInput 或在服务端 pipelineState 中持久化 userInput
