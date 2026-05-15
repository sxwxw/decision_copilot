## 新增需求

### 需求:多步流水线端点

系统 SHALL 提供 POST `/api/decision/full-pipeline` 端点，使用 SSE 推送流水线进度。

#### 场景:SSE 进度推送
- **当** 客户端发起 POST 请求到 `/api/decision/full-pipeline`
- **那么** 服务端设置 `Content-Type: text/event-stream`，每步完成后发送 SSE 事件
