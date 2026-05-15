## 1. 频率限制中间件

- [x] 1.1 安装 `express-rate-limit` 依赖
- [x] 1.2 在 `server/index.js` 中对 `/api/decision/*` 路由添加 rate-limit 中间件
- [x] 1.3 配置：15 分钟窗口，最多 20 次请求

## 2. 健康检查增强

- [x] 2.1 修改 `/api/health` 路由，增加 LLM 状态检测、uptime、version
- [x] 2.2 实现 LLM 可用性检测（可通过一次轻量级 API 调用或缓存状态）

## 3. 输入校验 fail-with-warning

- [x] 3.1 修改 `/validate` 路由的 catch 块，返回 `{ valid: true, fallback: true, message }` 并记录日志
