## 为什么

当前 LLM 返回的决策模型数据仅依赖 `sanitizeModel()` 静默修正——类型错误被替换为空数组/默认值，非法 key 被默默过滤。这导致：

1. **LLM 幻觉无感知**：模型数据不合法时，用户收到残缺结果但无提示
2. **前后端行为不一致**：前端 sanitizer 严格重建变量/过滤 trade_offs，服务端 sanitizer 仅做基础类型校验。绕过前端直接调用 API 时，畸形数据可进入系统
3. **调试困难**：数据被静默修正后，开发者无法追踪 LLM 到底返回了什么错误结构

此变更在所有静默修正之前增加一层**严格校验**，校验失败时返回结构化错误（HTTP 400 + `errors[]`），让用户知道问题在哪。

## 变更内容

在服务端和前端各新增一层 `validateModel` 校验，返回 `ModelValidationError[]`，按 error/warning 级别处理。

- **error** 级别：拒绝请求，返回 HTTP 400 + 结构化错误列表
- **warning** 级别：允许通过，保留现有 `sanitizeModel()` 自动修正，同时在 UI 中标注

## 功能 (Capabilities)

### 新增功能

- `model-validation`: 结构化校验层，在 LLM JSON 解析后、sanitizeModel 前运行，返回 error/warning 级别的错误列表。覆盖 options、weights、scores、paths、trade_offs 的完整性、范围、语义一致性校验

### 修改功能

- `sanitize-model-data`: sanitizeModel 现在仅处理 warning 级别的自动修正逻辑，不再承担 error 级别的拒绝决策
- `backend-api`: POST `/api/decision/model` 和 `/api/decision/simulate` 在 LLM 返回后增加 validateModel 步骤，校验失败时返回 400 而非进入 sanitize

## 影响

- **服务端**：`server/routes/decision.js` 新增 `validateModel()` 函数及中间件调用
- **前端**：`src/composables/useDecisionModel.js` 新增 `validateModel()` 函数，在 API 调用失败时展示结构化错误
- **API 契约**：所有返回模型数据的端点（`/model`、`/simulate`、`/refine`）可能新增 400 响应体 `{ errors: ModelValidationError[] }`
- **现有 sanitizer**：职责从"校验+修正"缩减为"仅修正"
