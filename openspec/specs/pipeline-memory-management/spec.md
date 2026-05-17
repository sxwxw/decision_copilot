## 新增需求

### 需求:Pipeline 状态内存回收

系统 SHALL 在服务端 in-memory pipelineState 中实现 LRU + TTL 清理机制，防止长期运行后内存无限增长。

#### 场景:新 pipeline 创建时触发清理
- **当** 新的 pipeline 被创建并写入 pipelineState
- **那么** 系统检查 entry 数量，超过 100 条时清理最早的条目

#### 场景:过期 pipeline 被清理
- **当** pipeline 的 createdAt 时间超过 24 小时
- **那么** 该 entry 被从 pipelineState 中移除

#### 场景:被清理的 pipeline resume 返回 404
- **当** 用户对已被清理的 pipelineId 调用 resume 接口
- **那么** 返回 404 和错误信息 "Pipeline not found"
