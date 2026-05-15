## 上下文

当前 LLM 返回的决策模型数据仅依赖 `sanitizeModel()` 做静默修正——类型错误被替换为空数组/默认值，非法 key 被默默过滤。前后端各有一份 sanitizer，行为不一致（前端更严格，服务端仅做类型校验）。LLM 幻觉（如 options 为空、概率超出范围、trade_offs 引用不存在的变量）无感知。

## 目标 / 非目标

**目标：**
- 在服务端和前端各新增 `validateModel()` 函数，在 LLM JSON 解析后、`sanitizeModel()` 前运行
- 返回 `ModelValidationError[]`，按 error/warning 分级
- error 级别拒绝请求（HTTP 400 + errors[]），warning 级别允许通过但交由 sanitizer 修正
- 覆盖核心数据结构的完整性、范围、语义一致性校验

**非目标：**
- 不修改 LLM prompt 或重试逻辑
- 不替代现有 `sanitizeModel()`—— sanitizer 继续处理 warning 级别的自动修正
- 不做前端 UI 层面的错误展示细节（那是后续变更的范围）

## 决策

### 1. 校验层位置：validate → sanitize 两阶段

```
LLM JSON → validateModel() → [error? reject] → sanitizeModel() → 返回
```

**为什么不是合并为一个函数？**
- `validate` 负责"发现并报告问题"，`sanitize` 负责"修正可修复的问题"
- 职责分离后，error 级别的问题可以追溯 LLM 输出质量；合并后静默修正掩盖了问题

### 2. 服务端优先，前端复用规则

服务端先实现完整的 `validateModel()`，前端后续实现一份规则子集。因为：
- 服务端是安全边界，任何绕过前端的请求都应被拦截
- 前端 sanitizer 当前已做了大量清洗工作，validator 只需在 sanitizer 前增加 error 检查

### 3. 校验规则分三层

| 层级 | 示例 | 级别 |
|------|------|------|
| 结构完整性 | options 至少 2 个 | error |
| 范围校验 | weights 在 [0,1]，scores 在 [0,100] | error |
| 语义一致性 | trade_offs.dimension ∈ variables | warning（sanitizer 可修正）|

**为什么 semantic 是 warning？**
因为这些是 LLM 常犯但无害的错误（拼写差异、别名），sanitizer 可以自动归一化。

### 4. 错误格式

```js
{
  errors: [
    { field: "options", message: "至少需要 2 个选项", severity: "error" },
    { field: "weights.技术风险", message: "权重超出 [0, 1] 范围 (1.2)", severity: "error" }
  ]
}
```

字段使用 dot-notation 定位（如 `weights.风险偏好`、`paths[2].timeline[1].probability`），便于前端高亮。

## 风险 / 权衡

[风险] → 校验过严导致正常请求被拒绝
→ 缓解：初始版本规则保守，error 仅覆盖明显的结构/范围错误；语义问题一律 warning

[风险] → Mock 模式下 sanitizer 被跳过，validator 的行为难以本地验证
→ 缓解：validator 单元测试独立于 LLM，可纯逻辑验证

[风险] → 前后端 validator 规则不一致
→ 缓解：后续可抽取为共享模块（如 `src/utils/modelValidator.js` 在服务端也可 import）
