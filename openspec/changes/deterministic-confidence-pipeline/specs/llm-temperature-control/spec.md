# Spec: llm-temperature-control

## 新增需求

### 需求:Temperature/Seed 双态差异化配置

`callQwen()` 函数 SHALL 根据步骤的职能模式（mode）差异化设置 temperature 和 seed 参数。理性态追求确定性输出，对抗态保留攻击创造力。

#### 场景:理性态调用
- **当** 步骤 mode 为 `rational`（如 framework、build-model、nexus、SEE 子步）
- **那么** 系统 MUST 使用 `temperature = 0.05` 和固定的 `seed` 值

#### 场景:对抗态调用
- **当** 步骤 mode 为 `adversarial`（如 devil-model、devil-simulate、devil-nexus）
- **那么** 系统 MUST 使用 `temperature = 0.45` 和 `seed = Math.floor(Math.random() * 10000)`

#### 场景:无 mode 参数时向后兼容
- **当** `callQwen()` 未传入 mode 参数
- **那么** 系统 MUST 使用 `temperature = 0.7`（保持向后兼容，等同于当前行为）

## 修改需求

### 需求:Pipeline 步骤定义

`PIPELINE_STEPS` 数组 SHALL 为每个步骤声明 `mode` 字段（`rational` 或 `adversarial`）。管线调度器 SHALL 在调用 `callQwen()` 时传入对应 mode。

#### 场景:理性态步骤执行
- **当** 执行 `framework` 步骤（mode: rational）
- **那么** `callQwen()` 使用 T=0.05 + 固定 seed

#### 场景:对抗态步骤执行
- **当** 执行 `devil-model` 步骤（mode: adversarial）
- **那么** `callQwen()` 使用 T=0.45 + 随机 seed

#### 场景:SEE 子管线步骤使用理性态
- **当** `executeSeeSubPipeline()` 调用 `callQwen()`
- **那么** 所有 3 个 SEE 子步 MUST 使用 mode: rational
