## 1. Props 声明修复

- [x] 1.1 在 PathDetail.vue 的 defineProps 中声明 pipelineNexus prop（类型 Object，默认 null）

## 2. Tab 接入

- [x] 2.1 在 PathDetail.vue 中导入 NexusReport 组件
- [x] 2.2 在概览面板的 tab 切换器中新增「综合报告」按钮，绑定 overviewTab = 'nexus'
- [x] 2.3 在 tab 内容渲染区域添加 NexusReport 组件渲染分支，传入 pipelineNexus 数据

## 3. Prop 传递验证

- [x] 3.1 确认 DecisionView.vue 已正确传递 pipelineNexus prop 到 PathDetail.vue（如缺失则补充）
- [x] 3.2 确认 useDecisionModel.js 已 export pipelineNexus computed（已在 return 中导出）

## 4. 置信度升级：后端 Prompt

- [x] 4.1 升级 DECISION_NEXUS_PROMPT，将 confidence_level 从 `"高|中|低"` 改为 `0-100` 数值，prompt 中增加判断依据描述
- [x] 4.2 nexus 步骤的 userPrompt 构造中计算并传入：分差、审查问题统计、rank flips、概率总和

## 5. 置信度升级：前端 UI

- [x] 5.1 修改 NexusReport.vue 的置信度渲染逻辑，支持 0-100 数值 + 三级视觉（高 >85% 绿线、中 60-85% 黄警示、低 <60% 橙红虚线）
- [x] 5.2 添加操作引导文案（直接决策 / 人工核验 / 重置模型）
