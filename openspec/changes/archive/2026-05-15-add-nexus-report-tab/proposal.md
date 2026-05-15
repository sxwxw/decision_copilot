## 为什么

流水线中的 NEXUS 步骤（综合报告）已经由后端生成，前端 NexusReport.vue 组件也已写好，但从未接入 UI。用户跑完深度验证后，看不到最终的执行摘要和置信度评估。

此外，NEXUS Agent 当前的 `confidence_level` 只是 LLM 凭直觉输出，没有结构化判断依据，导致报告中明明有 10 个审查问题却标"高"置信度的矛盾情况。

## 变更内容

- 在 PathDetail.vue 的概览 tab 切换器中新增「综合报告」tab
- 将 NexusReport.vue 接入渲染流程，接收 pipelineNexus 数据
- 新增的 tab 在 pipelineNexus 为空时显示引导提示（提示先跑流水线）
- 在 DecisionView.vue 中正确传递 pipelineNexus prop 到 PathDetail.vue
- 升级 NEXUS prompt：将 `confidence_level` 从 `"高|中|低"` 改为 `0-100` 数值，并传入结构化判断信号
- 置信度 UI 按阈值分级渲染：>85% 绿色细线（直接决策）、60-85% 黄色警示（人工核验）、<60% 橙红虚线（重置模型）

## 功能 (Capabilities)

### 新增功能

- `nexus-report-tab`: 在决策结果概览面板中新增"综合报告"tab，展示流水线 NEXUS Agent 生成的执行摘要、推荐方案、关键洞察、置信度和注意事项。

### 修改功能

- `multi-agent-pipeline`: NEXUS 步骤的 prompt 和输出结构变更，`confidence_level` 从文本升级为 `0-100` 数值，且调用时传入判断信号（分差、审查问题数量、rank flips、概率和）。

## 非目标

- 不改变流水线执行顺序或步骤
- 不修改 NexusReport.vue 组件的内部展示逻辑（已有组件复用）

## 影响

- `server/prompts/decisionModel.js`：升级 `DECISION_NEXUS_PROMPT`，增加置信度判断信号传入
- `server/routes/decision.js`：nexus 步骤的 userPrompt 构造增加判断信号
- `src/components/decision/PathDetail.vue`：新增 tab 按钮 + NexusReport 渲染
- `src/components/decision/NexusReport.vue`：置信度渲染升级（需支持 0-100 数值 + 三级视觉）
- `src/views/DecisionView.vue`：补充 pipelineNexus prop 传递
