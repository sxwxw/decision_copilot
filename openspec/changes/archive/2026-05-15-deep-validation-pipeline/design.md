## 上下文

当前 `transform-pipeline-to-deep-validation` 变更将深度验证实现为单次 LLM 调用（`/deep-validation` → `DECISION_VALIDATE_PROMPT`），但用户期望深度验证与多 Agent 流水线同样严谨，采用 5 步渐进式校验（FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS）。关键区别：流水线在已有模型基础上深化，保持 options/weights 不变。

## 目标 / 非目标

**目标：**
- `/full-pipeline` 支持可选的 `currentModel` 参数，有则走深度验证模式，无则走快速建模流水线
- 各 Agent prompt 注入 currentModel 约束，保持已有结构
- 前端 `runDeepValidation()` 改为复用 `runPipeline()`
- 移除 `/deep-validation` 路由和 `DECISION_VALIDATE_PROMPT`
- PipelineProgress 标题改为"深度验证"

**非目标：**
- 不改变现有快速建模路径
- 不引入 9 步流水线
- 不改变 `/full-pipeline` 无 `currentModel` 时的行为

## 决策

### 1. 复用 `/full-pipeline`，不新建路由

- **决策**：在 `/full-pipeline` 接收可选 `currentModel` 参数，有值时切换为深度验证模式
- **理由**：与现有流水线共享 SSE 推送、断点续跑、前端 PipelineProgress 组件，避免重复实现
- **替代方案**：新建 `/deep-validation` SSE 路由——但代码重复，维护成本高

### 2. 各 Agent prompt 注入 currentModel 约束

| Agent | currentModel 注入方式 |
|-------|----------------------|
| FRAMEWORK | 参考已有 options 和 variables，在其基础上细化维度 |
| MODEL-BUILD | 保持 options/weights 不变，补全 trade_offs、treeData |
| SIMULATE | 使用已有 sim_spec，不做额外约束 |
| DEVIL | 针对已有模型进行对抗性审查 |
| NEXUS | 融合流水线结果与当前模型，确保结构一致性 |

### 3. 前端：`runDeepValidation()` 调用 `runPipeline()`

- **决策**：复用已有的 `runPipeline()` 方法和 PipelineProgress 组件
- **理由**：SSE 流式 5 步进度已有完整实现，无需重写
- **替代方案**：新建独立方法——但需要重写 SSE 处理和进度展示逻辑

## 风险 / 权衡

[风险] 5 步流水线调用 LLM 次数多，延迟显著高于单步验证
→ 缓解：用户主动选择深度验证，已预期较长的等待时间

[风险] 各步骤注入 currentModel 约束可能限制 LLM 的创造力
→ 缓解：仅约束 options/weights 不变，允许 LLM 自由扩展路径和 trade_offs
