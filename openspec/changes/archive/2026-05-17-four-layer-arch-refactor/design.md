## 上下文

项目代码由 AI 辅助生成，`src/composables/useDecisionModel.js` 1469 行承担了 8+ 个职责（状态管理、验证、评分、蒙特卡洛、敏感性分析、Pipeline 编排、持久化）。评分公式散落在 3 文件 6 处，前后端 `validateModel/sanitizeModel` 各自独立，SSE 无超时/取消，Devil 异步未 await。只有 `DecisionView.vue` 一个文件消费 `useDecisionModel`，这降低了重构风险。

## 目标 / 非目标

**目标：**

- 建立四层架构：视图层 → 状态编排层 → 领域核心层 → 基础设施层
- 每个纯引擎模块 < 200 行，职责单一
- 消除所有已知重复代码（评分公式、adjustedProb 查找、validateModel）
- 修复 20+ 个已知设计缺陷（SSE 超时、async await、NaN 防护、PDF 时间戳等）
- 新增功能时只需修改对应引擎，不影响其他层

**非目标：**

- 不修改后端 API 路由签名
- 不改变 LLM Prompt 内容
- 不引入 Pinia（保持 Composables）
- 不改变用户可见功能行为

## 决策

### 1. 新增 `src/engines/` 目录作为领域核心层

选择独立目录而非放在 `src/utils/` 下，因为 `engines/` 内的模块是有状态的领域引擎（需要配置、有输入输出契约），而 `utils/` 是无状态工具函数。

```text
src/engines/
├── scoreEngine.js          # 唯一评分公式源
├── treeAdapter.js          # 树结构适配、路径索引
├── probNormalizer.js       # 概率归一化
├── sensitivityEngine.js    # 敏感性分析 + EVIU（信息价值分析）
├── scoreAttribution.js     # 评分归因、维度影响排名
├── pipelineStateMachine.js # Pipeline 步骤状态机（纯 JS）
└── correlationSampler.js   # 蒙特卡洛相关性抽样（Gaussian Copula / Cholesky）
```

**EVIU 归属决策：** 信息价值分析本质上是敏感性分析的延伸——它依赖蒙特卡洛结果和敏感度排名来识别"最值得调研的变量"。将其放在 `sensitivityEngine.js` 而非独立文件，因为：(a) EVIU 计算复用 Monte Carlo 已有样本，(b) 输出格式与敏感性分析一致（变量级指标），(c) 用户感知上 VOI 是敏感性分析的"下一步建议"。

**Correlation 归属决策：** 相关性抽样是 Monte Carlo 的核心机制升级，放在 `correlationSampler.js` 作为独立引擎。它与现有 `src/utils/simulator.js` 的关系：simulator.js 提供采样器接口，correlationSampler.js 实现带相关性的抽样，simulator.js 调用 correlationSampler.js。`correlation_matrix` 由 LLM 在建模时生成并输出到 sim_spec，前端只消费不推断。

**deriveTradeoffs 归属决策：** deriveTradeoffs 是 LLM 偶尔漏输出 trade_offs 时前端的补丁。重构后将其移至后端的 `modelValidator.js`（shared/）中作为 sanitizeModel 的一部分——如果 LLM 返回的模型缺少 trade_offs，后端在返回给前端前补全。前端不再承担此职责。

**反事实场景：** 页面实际没有此功能，相关代码（counterfactuals、applyCounterfactual、resetCounterfactual 等约 80 行）是历史遗留，重构时直接移除，不提取为独立引擎。

### 2. Composable 保留原名，变为纯编排层

不重命名文件。`useDecisionModel.js` 保留原路径，只重构内容。降低 git diff 和引用变更风险。

重构后只负责：持有 reactive state、组合各 engine 调用、暴露方法给 View 层（返回对象签名不变）。

**ElMessage 处理决策：** composable 目前直接 import 并调用 ElMessage（12 处）。重构时保持 composable 继续调用 ElMessage——这是"业务逻辑通知 UI"的合理边界。不在引擎层调用 ElMessage。未来若需切换通知方式，可在 composable 内部替换，不影响其他层。

### 3. 新增 `src/services/` 目录作为基础设施层

```text
src/services/
├── storage.js              # localStorage get/set/clear
└── sseClient.js            # SSE 流管理，AbortController、超时、断线检测
```

### 4. `shared/` 目录存放前后端共享模块

```text
shared/
├── modelValidator.js       # validateModel, sanitizeModel
└── scoreEngine.js          # calcScoreOffset, calcScoreOffsetDecimal
```

- **Vite 侧**：配置 `resolve.alias: { '@shared': path.resolve(__dirname, '../shared') }`
- **Node 侧**：使用相对路径 `require('../shared/modelValidator.js')`（Express 入口到 shared 的距离）
- **文件格式**：使用 ESM export（`export function`），Vite 原生支持 ESM；后端路由文件用 `import` 替代 `require`（Express 5 已支持 ESM 当 package.json 设 `"type": "module"`）

### 5. 评分公式统一为 `calcScoreOffset`

所有 6 处的 `(pv/100 - 0.5) * delta * 2` 统一为：

```javascript
// shared/scoreEngine.js
export function calcScoreOffset(pv, base = 50, delta, weight = 1) {
  const normalized = (pv - base) * delta * 2 / 100
  return normalized * weight
}
```

支持 Decimal.js 版本（`calcScoreOffsetDecimal`）用于高精度场景。

### 6. 引擎间依赖图（DAG，无循环风险）

```text
  probNormalizer    treeAdapter    pipelineStateMachine
        \               /                    |
         \-- scoreEngine                     |
                 |                           |
                 +-- scoreAttribution         |
                 +-- sensitivityEngine(+EVIU) +-- sseClient (infra)
                 |
                 +-- correlationSampler (simulator.js 调用)
```

- **Group A**（零内部依赖，可并行）：probNormalizer、treeAdapter、pipelineStateMachine、correlationSampler
- **Group B**（读取 scores 数据，传入参数即可）：scoreAttribution、sensitivityEngine（含 EVIU）
- **无循环**：scoreAttribution/sensitivityEngine 消费 scores 输出，不生产它们；correlationSampler 被 simulator.js 调用，不反向依赖

### 7. Bug 到任务的映射

每个已知 bug 必须有明确的修复任务：

| Bug | 修复任务 | 文件 |
| --- | --- | --- |
| #1 SSE 无超时/取消 | 1.2 + 4.9 | sseClient.js |
| #2 runDevilReview 未 await | 4.10 | useDecisionModel.js |
| #3 服务端写已关闭连接 | 6.2 | server/routes/decision.js |
| #4 Monte Carlo NaN | 6.4 | simulator.js |
| #5 概率归一化偏差 | 2.1 | probNormalizer.js |
| #6 选项名含 → | 2.2 | treeAdapter.js |
| #7 分类采样偏置 | 6.5 | simulator.js |
| #8 反事实评分基准 | — | 反事实场景已移除，无需修复 |
| #9 matchNode 匹配失败 | 2.2 | treeAdapter.js |
| #10 saveToStorage 时机错误 | 4.10 | useDecisionModel.js |
| #11 _idCounter 并发碰撞 | 2.2 | treeAdapter.js |
| #12 pipelineState 内存 | 6.3 | server/routes/decision.js |
| #13 SSE 解析吞错误 | 1.2 | sseClient.js |
| #14 DashScope 429 退避 | 后端独立修复 | llmService.js |
| #15 PDF 时间戳 | 5.1 | ReportTemplate.vue |
| #16 PDF 渲染等待 | 6.7 | PathDetail.vue |
| #17 D3 状态模块级 | 5.4 | DecisionTree.vue |
| #18 deep watch 冲突 | 5.4 | DecisionTree.vue |
| #19 global ID 冲突 | 6.7 | PathDetail.vue |

### 8. 组件降级为哑组件

| 组件 | 变化 |
|------|------|
| `PathDetail.vue` | 移除评分计算、归因逻辑，只接收 props 渲染 |
| `ForkComparison.vue` | 移除 `suggestion` 计算，由 composable 提供 |
| `ReportTemplate.vue` | 移除 `safetyMargins`、`hedgeSuggestion` 等计算 |
| `DecisionTree.vue` | D3 状态从模块级移到组件实例 |

### 9. 逐阶段迁移而非一次性重写

采用阶段策略：先创建新引擎 + 基础设施 → 在 composable 内调用新模块 → 确认无回归 → 删除旧代码。避免同时修改所有文件。

```text
阶段 1: 基础设施层 + shared/ (storage, sseClient, shared/validator, shared/scoreEngine)
阶段 2: 核心引擎拆分 (scoreEngine, treeAdapter, probNormalizer, correlationSampler) — 消除重复
阶段 3: 复杂引擎 (sensitivity+EVIU, pipelineStateMachine) — 中风险
阶段 4: Composable 编排 — 用新引擎替换旧逻辑（含移除反事实场景代码）
阶段 5: 组件降级 — 移除业务逻辑
阶段 6: Bug 修复 — SSE 超时、NaN 防护、PDF 等
阶段 7: 清理 — 删除旧文件、死代码
```

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|----------|
| 1469 行拆分为 10+ 文件，模块间接口定义错误 | 每个 engine 先写纯函数 + 输入输出契约，再集成 |
| Composable 返回值签名变更导致 DecisionView 崩溃 | 保持 composable 返回对象的 API 兼容，View 层不改 |
| 前后端共享 validator 时路径引用失败 | 先确保 Vite alias 和 Express ESM 都能解析 |
| 重构过程中功能回归 | 每次只迁移一个职责，验证后再继续 |
| `DecisionTree.vue` D3 状态从模块级改为实例级 | 当前只有一个树组件实例，风险可控 |
| shared/ 的 ESM 文件被 Node require | 后端用 `import` 语句替代 `require`，Express 5 支持 ESM |
| Cholesky 分解在 JS 中实现复杂度较高 | 先用 NPM 包（如 `mathjs` 或纯手写 2x2/3x3 矩阵版本），后续再优化 |
| EVIU 计算基于已有 Monte Carlo 样本，统计精度有限 | 接受统计噪声，这是"近似值"不是"精确解"，用户感知为方向性指导 |
