## 上下文

Express 5 后端，无认证，无频率限制。`.env` 中的 API key 仅用于调用 LLM。Vercel 部署时 `maxDuration: 60`。

## 目标 / 非目标

**目标：**
- 防止无限制的 API 调用（IP 级限流）
- 修复 `/validate` 的 fail-open 漏洞
- 健康检查反映 LLM 服务状态

**非目标：**
- 不引入用户认证/登录
- 不实现应用级 API key 验证（后续变更）

## 决策

### 1. 频率限制：express-rate-limit 中间件

使用 `express-rate-limit`，配置：
- windowMs: 15 分钟
- max: 20 次请求/窗口（仅针对 /api/decision/*）
- skipSuccessfulRequests: false（失败也计数，防止探测）

### 2. /validate fail-with-warning

LLM 不可用时返回 `{ valid: true, fallback: true, message: "验证服务不可用，已放行" }` 并在服务端日志记录。

### 3. 健康检查增强

GET /api/health 返回 `{ status: "ok" | "degraded", llm: "available" | "unavailable", uptime, version }`

## 风险 / 权衡

[风险] → 限流阈值可能影响正常使用
→ 缓解：初始阈值 20次/15分钟 较宽松，可根据实际使用情况调整

[风险] → express-rate-limit 是新增 npm 依赖
→ 缓解：这是一个成熟的小型库，维护活跃，风险低