## 新增需求

### 需求:SSE 流可被中断

系统 SHALL 支持通过 AbortController 中断正在执行的 SSE pipeline 流。当用户重复提交或导航离开时，当前 pipeline 连接必须被终止。

#### 场景:重复提交中断旧连接
- **当** 用户在前一个 pipeline 执行中再次提交
- **那么** 前一个 pipeline 的 AbortController.signal 被触发，fetch 连接终止
- **那么** 新的 pipeline 正常启动

#### 场景:AbortError 被静默处理
- **当** fetch 抛出 AbortError
- **那么** runPipeline 的 catch 块识别 AbortError 并静默返回，不显示错误提示

#### 场景:正常完成时 controller 被清理
- **当** pipeline 正常完成
- **那么** AbortController 引用被清空，不残留

#### 场景:signal 参数传递到 fetch 调用
- **当** runFullPipeline 被调用
- **那么** signal 参数被传递给底层 fetch 请求

## 修改需求

### 需求:Pipeline SSE 流管理

系统 SHALL 在用户取消或重复提交时正确终止 SSE 连接，释放服务端 LLM 调用资源。

#### 场景:用户离开页面取消 Pipeline
- **当** 用户在 Pipeline 执行中导航离开
- **那么** SSE 流被 AbortController 终止，不继续占用资源

#### 场景:AbortError 不触发错误提示
- **当** fetch 因 AbortController 抛出 AbortError
- **那么** 前端不显示 "流水线执行失败" 错误消息
