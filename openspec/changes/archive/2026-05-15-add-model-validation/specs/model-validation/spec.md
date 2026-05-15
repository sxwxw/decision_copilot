# spec: model-validation

## 新增需求

### 需求:validateModel 函数

系统 SHALL 提供 `validateModel(raw: unknown)` 函数，接收 LLM 返回的原始 JSON 对象，返回 `ModelValidationError[]` 数组。

```ts
interface ModelValidationError {
  field: string       // dot-notation 路径
  message: string     // 人类可读的错误信息
  severity: "error" | "warning"
}
```

#### 场景:校验通过的合法数据
- **当** 输入的 JSON 包含合法的 options（≥2个）、weights（值在[0,1]）、scores（值在[0,100]）、paths、treeData 且 trade_offs 的 dimension 都在变量列表中
- **那么** 返回空数组 `[]`

#### 场景:选项不足
- **当** 输入的 options 数组长度 < 2
- **那么** 返回 `{ field: "options", message: "至少需要 2 个选项", severity: "error" }`

#### 场景:权重超出范围
- **当** weights 中某个 key 的值 < 0 或 > 1
- **那么** 返回 `{ field: "weights.<key>", message: "权重 <key> 超出 [0, 1] 范围 (<实际值>)", severity: "error" }`

#### 场景:分数超出范围
- **当** scores 中某个 key 的值 < 0 或 > 100
- **那么** 返回 `{ field: "scores.<key>", message: "分数 <key> 超出 [0, 100] 范围 (<实际值>)", severity: "error" }`

#### 场景:路径概率非法
- **当** paths 中某个 path 的 probability 字段 < 0 或 > 1
- **那么** 返回 `{ field: "paths[<index>].probability", message: "概率超出 [0, 1] 范围", severity: "error" }`

#### 场景:路径概率总和偏离 1.0
- **当** 所有 paths 的 probability 总和与 1.0 的差值 > 0.05
- **那么** 返回 `{ field: "paths", message: "路径概率总和为 <实际值>，应 ≈ 1.0", severity: "warning" }`

#### 场景:trade_offs dimension 不存在于变量列表
- **当** 某节点的 trade_offs 中存在 dimension 不在 variables.name 列表中
- **那么** 返回 `{ field: "treeData.trade_offs[*].dimension", message: "维度 <dimension> 不在变量列表中", severity: "warning" }`

#### 场景:timeline impact key 不存在于变量列表
- **当** paths[].timeline[].impact 中存在 key 不在 variables.name 列表中
- **那么** 返回 `{ field: "paths[<i>].timeline[<j>].impact.<key>", message: "维度 <key> 不在变量列表中", severity: "warning" }`

#### 场景:weights 值总和不为 1
- **当** weights 所有值的总和与 1.0 的差值 > 0.05
- **那么** 返回 `{ field: "weights", message: "权重总和为 <实际值>，应 ≈ 1.0", severity: "warning" }`

#### 场景:非对象输入
- **当** 输入为 null、非对象类型、或 undefined
- **那么** 返回 `{ field: "*", message: "模型数据格式错误", severity: "error" }`

### 需求:服务端校验中间件

服务端 SHALL 在 `/model`、`/simulate`、`/refine` 三个路由的 LLM 返回后、`sanitizeModel()` 调用前，先执行 `validateModel()`。

#### 场景:校验包含 error 级别
- **当** `validateModel()` 返回的数组中存在 severity 为 "error" 的项
- **那么** 服务端返回 HTTP 400，响应体为 `{ errors: ModelValidationError[] }`，不调用 `sanitizeModel()`

#### 场景:校验仅有 warning 级别
- **当** `validateModel()` 返回的数组中仅有 severity 为 "warning" 的项
- **那么** 服务端继续调用 `sanitizeModel()`，并在响应体中附加 `{ warnings: ModelValidationError[] }`

#### 场景:校验通过无错误
- **当** `validateModel()` 返回空数组
- **那么** 服务端正常调用 `sanitizeModel()` 并返回结果

### 需求:前端校验

前端 SHALL 在 `useDecisionModel.js` 中实现 `validateModel()` 函数，与 `sanitizeModel()` 共享相同的校验规则。

#### 场景:API 返回校验错误
- **当** API 返回 400 且响应体包含 `errors` 数组
- **那么** 前端展示 ElMessage.error 提示用户，不更新 state.model

#### 场景:API 返回警告
- **当** API 返回 200 且响应体包含 `warnings` 数组
- **那么** 前端正常更新 state.model，同时通过 ElMessage.warning 展示警告信息

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

**修改说明：** sanitizeModel 现在仅处理 warning 级别及以下的问题（静默修正可修复的错误），error 级别的问题应由 validateModel 在 sanitizeModel 之前拒绝。
