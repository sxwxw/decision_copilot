## 修改需求

### 需求:旧版审查 prompt 统一 select 变量规则

`DECISION_DEVIL_PROMPT`（旧版单调用审查）必须与 `DECISION_DEVIL_MODEL_PROMPT`（流水线模型审查）保持一致：select 类型变量（如"风险偏好"）不参与权重打分是预期行为，审查时不得将其列为"inconsistency"类型的高级别问题。

#### 场景:审查不把风险偏好权重为0当作错误
- **当** 模型包含"风险偏好"(select 类型)变量且不在 weights 中
- **那么** 旧版审查 prompt 不应生成 type 为 "inconsistency" 的 challenge 指出该变量权重缺失
