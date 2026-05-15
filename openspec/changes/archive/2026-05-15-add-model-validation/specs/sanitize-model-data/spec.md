# spec: sanitize-model-data

## 修改需求

### 需求:结构格式化

系统 SHALL 在 `sanitizeModel` 调用时强制以下字段为正确类型：
- `options` → `string[]`（错误时空数组）
- `variables` → `object[]`（错误时补全最小集合）
- `weights` → `object`（错误时空对象）
- `treeData` → `object`（错误时默认根节点）
- `paths` → `object[]`（错误时空数组）
- `scores` → `object`（错误时空对象）
- `recommendation` → `object`（错误时默认空结构）

**修改说明：** sanitizeModel 不再承担 error 级别的拒绝决策，仅处理可自动修正的 warning 级别数据清洗。error 级别的拒绝由 `validateModel` 在调用 `sanitizeModel` 之前完成。
