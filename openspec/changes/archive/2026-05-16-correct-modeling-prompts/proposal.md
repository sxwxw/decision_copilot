## 为什么

LLM 初始建模存在三个结构性缺陷，导致模型可信度下降：
1. 风险偏好仅作为 LLM 建模参考，没有量化作用机制，导致审查报出假阳性（"权重为0"）
2. delta 分配没有范围约束，LLM 凭直觉给出悬殊值（如稳定性 +25 vs -35），天然锚定现状
3. 旧版审查 prompt 与新版流水线审查 prompt 对同一规则（select 变量不参与权重）存在矛盾

建模速度再快，模型错了也没有用。需要在 prompt 层面约束 LLM 输出更合理的模型。

## 变更内容

### 1. 风险偏好量化机制
将风险偏好从"LLM 参考"升级为**显式概率调节因子**：在 `treeData` 的 Option 层级新增 `risk_adjustment` 字段，定义不同风险偏好类型下各选项基准分的偏移量。前端/仿真引擎根据用户选择的风险偏好类型查表加分，不再依赖 LLM 直觉。

### 2. Delta 范围约束
新增 delta 取值范围约束（±20），要求 LLM 给出每个 delta 的合理性说明，禁止跨选项同一维度 delta 差值超过 30。

### 3. 旧版审查 prompt 同步规则
`DECISION_DEVIL_PROMPT` 补充"select 类型变量不参与权重"规则，消除假阳性。

### 4. 评分公式纳入权重
当前评分公式中权重仅作为闸门，实际偏移来自 delta。改为将权重作为乘数纳入偏移计算，使权重分配真正影响分数。

## 功能 (Capabilities)

### 新增功能
- `risk-preference-adjustment`: 风险偏好作为显式概率调节因子，影响基准分和路径概率

### 修改功能
- `devil-review`: 旧版审查 prompt 同步 select 变量规则，消除假阳性
- `multi-agent-pipeline`: 各 prompt 中的 delta 约束和评分公式统一

## 非目标

- 不改变蒙特卡洛仿真引擎的采样逻辑
- 不新增任何 LLM 模型或外部 API
- 不修改前端 UI 组件

## 影响

- **server/prompts/decisionModel.js**: 所有建模和审查 prompt 更新
- **server/routes/decision.js**: 评分计算逻辑微调
- **src/utils/simulator.js**: 风险偏好调节因子纳入蒙特卡洛效用计算
- **src/composables/useDecisionModel.js**: 评分公式纳入权重乘数
