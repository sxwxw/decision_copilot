## 为什么

当前应用无任何认证、频率限制、配额管理。`/validate` 端点在 LLM 不可用时 fail-open（返回 `{ valid: true }`）。部署到 Vercel 后，任何知道 URL 的人都能无限制调用 LLM API，消耗 API 额度。

## 变更内容

新增基础 API 安全加固：修复 fail-open 漏洞、添加 IP 级频率限制、增强健康检查端点。

## 功能 (Capabilities)

### 新增功能

- `api-rate-limiting`: Express 中间件级别的频率限制，保护 `/api/decision/*` 路由。相关规范在 `specs/backend-api/spec.md` 中定义

### 修改功能

- `backend-api`: `/validate` 路由从 fail-open 改为 fail-with-warning；`/health` 路由增加 LLM 服务状态

## 影响

- `server/index.js` 新增 rate-limit 中间件
- `server/routes/decision.js` 修改 `/validate` 和 `/health` 路由
- `api/index.js`（Vercel serverless）同步更新