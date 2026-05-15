## 新增需求

### 需求:API 频率限制

系统 SHALL 在 Express 中间件层对 `/api/decision/*` 路由实施 IP 级频率限制。

#### 场景:正常频率请求
- **当** 客户端在 15 分钟窗口内发起的请求数 ≤ 20
- **那么** 请求正常处理

#### 场景:超频请求被拒绝
- **当** 客户端在 15 分钟窗口内发起的请求数 > 20
- **那么** 服务端返回 HTTP 429，响应体为 `{ error: "请求过于频繁，请稍后再试" }`

### 需求:输入校验 fail-with-warning

系统 SHALL 在 `/validate` 路由的 LLM 调用失败时，返回 `{ valid: true, fallback: true }` 并记录日志。

#### 场景:LLM 不可用
- **当** `/validate` 路由的 LLM 调用抛出异常
- **那么** 返回 `{ valid: true, fallback: true, message: "验证服务不可用，已放行" }` 并在控制台记录错误日志

### 需求:增强健康检查

系统 SHALL 在 GET `/api/health` 响应中包含 LLM 服务可用状态。

#### 场景:LLM 可用
- **当** 调用 GET `/api/health` 且 LLM 服务可用
- **那么** 返回 `{ status: "ok", llm: "available", uptime: "...", version: "..." }`

#### 场景:LLM 不可用
- **当** 调用 GET `/api/health` 且 LLM 服务不可用
- **那么** 返回 `{ status: "degraded", llm: "unavailable", uptime: "...", version: "..." }`

## 修改需求

（无现有需求需要修改）