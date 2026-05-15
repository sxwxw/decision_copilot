## 为什么

当前 DEVIL 审查是流水线最后一步，只在模型/仿真/结论完成后才"出来挑问题"。这使得 DEVIL 看起来像事后找茬，而非持续的质量保障。用户信任决策系统的不是"自信"，而是"谨慎"——一个会主动怀疑自己每个阶段输出的系统，比一个最后才给出对抗意见的系统更有说服力。

## 变更内容

- **DEVIL 从单一步骤扩展为贯穿全链路的对抗层** — 在 FRAMEWORK、BUILD-MODEL、SIMULATE、NEXUS 每个阶段后都插入 DEVIL 子步骤
- **4 个专用 DEVIL prompt** — 每个阶段攻击目标不同：
  - DEVIL-FRAMEWORK：攻击问题定义本身（为什么是二元选择？有没有中间路径？）
  - DEVIL-MODEL：攻击变量/权重/因果关系（重复加权？乐观命名？）
  - DEVIL-SIMULATE：攻击概率假设（均值依据？极端风险？）
  - DEVIL-NEXUS：生成条件化结论（依赖什么前提？对什么敏感？什么情况下失效？）
- **NEXUS Agent 整合所有 DEVIL 输出** — 最终结论不是"推荐 A"，而是"推荐 A，但依赖 X，敏感于 Y，在 Z 情况下失效"

## 功能 (Capabilities)

### 新增功能
- `devil-framework`: 在 FRAMEWORK 阶段后运行，质疑问题定义、选项穷举性、是否存在中间路径
- `devil-model`: 在 BUILD-MODEL 阶段后运行，质疑变量选取、权重分配、因果关系、重复加权、命名偏差
- `devil-simulate`: 在 SIMULATE 阶段后运行，质疑概率分布假设、均值依据、极端风险场景
- `devil-nexus`: 在 NEXUS 阶段后运行，生成条件化结论（前提依赖、敏感性、失效条件）
- `adversarial-pipeline`: 将 DEVIL 子步骤嵌入流水线执行引擎，每个主步骤后自动触发对应 DEVIL

### 修改功能
- `decision-core`: 流水线步骤从 5 步扩展为 9 步（4 个主步骤 + 4 个 DEVIL 步骤 + NEXUS），前端进度组件需适配新步骤序列

## 影响

- `server/prompts/decisionModel.js` — 新增 4 个 DEVIL 专用 prompt（DECISION_DEVIL_FRAMEWORK_PROMPT, DECISION_DEVIL_MODEL_PROMPT, DECISION_DEVIL_SIMULATE_PROMPT, DECISION_DEVIL_NEXUS_PROMPT）
- `server/routes/decision.js` — PIPELINE_STEPS 数组从 5 步扩展为 9 步，新增 executeDevilStep 逻辑
- `src/components/decision/PipelineProgress.vue` — 进度组件展示 DEVIL 子步骤（如 "FRAMEWORK → 🔍 DEVIL-FRAMEWORK → BUILD-MODEL → 🔍 DEVIL-MODEL ..."）
- `src/components/decision/PathDetail.vue` — 底部审查面板展示 4 个阶段的 DEVIL 输出，而非只展示最终结果

## 非目标

- 不改变现有 `/devil` 独立接口的行为（仍可单独调用）
- 不改变蒙特卡洛仿真引擎的核心算法
- 不改变前端参数面板的交互方式
- 不影响快速建模（/model）和深度验证（/deep-validation）的单次调用流程
