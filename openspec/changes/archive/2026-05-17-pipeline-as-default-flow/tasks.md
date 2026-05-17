# 实现任务清单

## 1. 后端蒙特卡洛集成

- [x] 1.1 在 `server/routes/decision.js` 中导入 `runMonteCarlo`（从 `src/utils/simulator.js`）
- [x] 1.2 修改 `executePipelineSteps` 的 simulate 分支：从 pipelineState 读取 build-model 结果，构建 simSpec，执行 runMonteCarlo
- [x] 1.3 将蒙特卡洛结果存入 `pipelineState[pipelineId].steps.simulate`
- [x] 1.4 修改 `devil-simulate` 步骤的 prompt 上下文，包含 pipelineState.steps.simulate 中的仿真排名和指标
- [x] 1.5 修改 `nexus` 步骤的置信度信号计算，加入蒙特卡洛排名和平均标准差；修改 `devil-nexus` 上下文，加入蒙特卡洛排名
- [x] 1.6 扩展 `/full-pipeline` 请求体，新增 `riskPreference` 字段并透传给 simulate 步骤

## 1b. 对抗层 Prompt 强化

- [x] 1b.1 devil-framework：改为"极度挑剔的风险管理专家"人格，强制至少 2 条质疑，必须引用框架具体内容，必须提出遗漏选项
- [x] 1b.2 devil-model：改为"极度抠门的 CFO"人格，强制至少 2 条质疑，必须引用具体变量名和数值，检查重复加权和 delta 约束
- [x] 1b.3 devil-simulate：改为"极度悲观的情景规划师"人格，强制至少 1 条质疑，必须引用具体分布参数和仿真数据
- [x] 1b.4 devil-nexus：改为"失效条件分析专家"人格，强制至少 2 条 dependencies 和 2 条 failure_modes
- [x] 1b.5 nexus：置信度判断依据新增"蒙特卡洛平均标准差"

## 2. 前端入口切换

- [x] 2.1 修改 InputPanel.vue：将按钮文案从"快速建模"改为"开始推演"
- [x] 2.2 修改 DecisionView.vue onSubmit：调用 runPipeline() 替代 buildModel()，先设置 state.riskPreference
- [x] 2.5 移除 DecisionView.vue 中的"深度验证"按钮和 deep-validation-section DOM
- [x] 2.3 修改 runPipeline 请求体：附带 riskPreference 参数
- [x] 2.4 修改 runPipeline 完成回调：从 `data.steps.simulate` 读取蒙特卡洛结果，赋值给 state.monteCarloResult；移除对 runDeepSimulation() 的调用

## 3. 清理 useDecisionModel

- [x] 3.1 移除 buildModel 函数及其所有实现
- [x] 3.2 移除 runDeepSimulation 函数（全部职责已由管线覆盖，避免蒙特卡洛和 devil 重复执行）
- [x] 3.3 移除 runDeepValidation 函数（已无调用场景）
- [x] 3.4 从 return 导出中移除 buildModel、runDeepValidation、runDeepSimulation
- [x] 3.5 移除导入的 validateInput（如果仅被 buildModel 使用）
- [x] 3.6 移除导入的 runMonteCarlo / runMC（如果仅被 runDeepSimulation 使用）

## 4. 管线 quick-build 模式验证

- [ ] 4.1 确认管线 executePipelineSteps 在无 currentModel 时能完整走完所有 LLM 步骤
- [ ] 4.2 确认前端 runPipeline 在 quick-build 模式下正确加载 state.model（读取 data.steps['build-model']）
- [ ] 4.3 确认敏感性分析在管线完成后自动可用（不依赖手动触发）
- [ ] 4.4 确认蒙特卡洛结果在前端 UI 中正常展示（蒙特卡洛表格、P10/P50/P90）
