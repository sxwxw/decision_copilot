# 实施任务清单

## 1. 基础设施层 + shared/

- [x] 1.1 创建 `src/services/storage.js` — localStorage 读写封装，版本管理，错误处理
- [x] 1.2 创建 `src/services/sseClient.js` — SSE 流管理，AbortController，60s 超时，错误回调，连接断开检测
- [x] 1.3 创建 `shared/modelValidator.js` — 前后端共享的 validateModel 和 sanitizeModel 纯函数（ESM 格式），包含 deriveTradeoffs 作为后端补全逻辑
- [x] 1.4 创建 `shared/scoreEngine.js` — calcScoreOffset 和 calcScoreOffsetDecimal 纯函数
- [x] 1.5 配置 Vite `resolve.alias` 指向 `shared/`，配置后端 ESM import

## 2. 核心引擎层（并行，零依赖组）

- [x] 2.1 创建 `src/engines/probNormalizer.js` — 概率归一化，NaN 防护，和为 1.0 保证
- [x] 2.2 创建 `src/engines/treeAdapter.js` — adaptTree、buildPathRefs、flattenTree、extractEvents、matchNode，_idCounter 改为局部变量
- [x] 2.3 创建 `src/engines/pipelineStateMachine.js` — Pipeline 步骤状态机（纯 JS，不含 SSE）
- [x] 2.4 创建 `src/engines/correlationSampler.js` — Gaussian Copula / Cholesky 分解实现相关抽样（被 simulator.js 调用）

## 3. 核心引擎层（依赖 Group B）

- [x] 3.1 创建 `src/engines/scoreAttribution.js` — getScoreAttribution、getScoreDiff、topImpactDimension（接收 scores 作为参数）
- [x] 3.2 创建 `src/engines/sensitivityEngine.js` — 敏感性分析，±20% 扰动，flip_count 计算
- [x] 3.3 在 sensitivityEngine 中实现 EVIU — 基于 Monte Carlo 样本计算信息价值，生成调研建议

## 4. Composable 编排层（逐函数替换 + 移除反事实场景）

- [x] 4.1 替换 storage 层 — `saveToStorage`/`loadFromStorage`/`clearStorage` 改为调用 `storage.js`
- [x] 4.2 替换 validator 层 — `validateModel`/`sanitizeModel` 改为调用 `shared/modelValidator.js`
- [x] 4.3 替换 tree adapter 层 — `adaptTree`/`buildPathRefs` 等改为调用 `treeAdapter.js`
- [x] 4.4 替换 score engine — `scores` computed 改为使用 `calcScoreOffset`，消除 6 处重复
- [x] 4.5 替换 score attribution — `getScoreAttribution`/`getScoreDiff` 改为调用 `scoreAttribution.js`
- [x] 4.6 替换 prob normalizer — `recalcProbabilities` 中的归一化段改为调用 `probNormalizer.js`
- [x] 4.7 替换 sensitivity 层 — `runSensitivity` 改为调用 `sensitivityEngine.js`
- [x] 4.8 替换 pipeline + SSE — `runPipeline` 改为调用 `pipelineStateMachine.js` + `sseClient.js`
- [x] 4.9 修复异步链 — `runDevilReview` 必须 await，`runDeepSimulation` await devil 后再 saveToStorage，`runPipeline` await 内部异步调用
- [x] 4.10 移除反事实场景 — 删除 `counterfactuals`、`applyCounterfactual`、`resetCounterfactual`、`counterfactualActive`、`activeCounterfactual`、`previousScores`、`saveCurrentScores`、`buildCounterfactuals` 及相关状态（约 80 行代码）

## 5. 视图层（组件降级）

- [x] 5.1 重构 `PathDetail.vue` — 移除评分计算、归因逻辑，只接收 props 渲染；PDF 导出时间戳改为 computed
- [ ] 5.2 重构 `ForkComparison.vue` — 移除 suggestion 计算，由 composable 提供 prop
- [ ] 5.3 重构 `ReportTemplate.vue` — 移除 safetyMargins、hedgeSuggestion 等计算，改为接收 props
- [ ] 5.4 重构 `DecisionTree.vue` — D3 状态从模块级变量改为组件实例 ref，移除 deep watch

## 6. 后端优化 + Bug 修复

- [x] 6.1 后端路由使用 `shared/modelValidator.js` 替代内嵌 validateModel/sanitizeModel
- [x] 6.2 后端 SSE sendEvent 检查连接状态，防止向已关闭连接写入
- [x] 6.3 后端 pipelineState 保存 userInput 以支持 resume
- [x] 6.4 修复 Monte Carlo NaN/Infinity — simSpec 验证 mean > 0，钳制 Beta 极端参数
- [x] 6.5 修复分类采样偏置 — sampleCategorical 在采样前归一化概率
- [x] 6.6 在 simulator.js 中集成相关性抽样 — sim_spec 支持 correlation_matrix 字段（LLM 输出）
- [x] 6.7 修复 PDF 渲染等待 — handleExport 用 MutationObserver 替代单 rAF
- [ ] 6.8 删除死代码 `MetricCard.vue`

## 7. 验证与清理

- [x] 7.1 确认 composable 返回值 API 兼容 — DecisionView 无需修改
- [x] 7.2 删除 useDecisionModel.js 中的旧代码 — validateModel、sanitizeModel、评分公式等
- [x] 7.3 运行 dev server 验证核心流程：输入 → 建模 → 调参 → 深度验证 → PDF 导出
- [x] 7.4 验证 mock 模式仍正常工作
