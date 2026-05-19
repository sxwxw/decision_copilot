## 为什么

当前决策管线的置信度分数（confidence_level）完全由 LLM 直接输出 0-100 的数字，没有任何后端代码参与计算。加上 `temperature: 0.7` 且无 seed，导致同一个问题多次运行可能出现 80% vs 25% 的断崖式差异。这不仅是"同题不同分"的稳定性问题，更是产品可解释性的根本缺陷——用户无法理解分数为什么变，开发者也无法判断是改修复生效了还是随机种子碰巧好。

## 变更内容

将决策管线从"LLM 随机打分"改造为"确定性定性输出 + 后端代码计算置信度"，包含三个层面的改造：

1. **温度锁定**：根据步骤职能区分理性态（T=0.05, 固定 seed）和对抗态（T=0.45, 随机 seed），从源头压制结构抖动。
2. **定性映射全链路接入**：Nexus 改为输出 `confidence_label` 定性标签，由后端查表为基准分后执行梯度扣分公式，消除 LLM 直接打分的数学幻觉。
3. **三锁熔断**：静态校验（拓扑完备性 + 因果循环）→ 蒙特卡洛校验 → 置信度梯度扣覆写。ERROR 触发强制死线，WARNING 执行静态扣分。
4. **外回路语义变更**：从"最多重试 5 次刷到及格"改为"仅跑一次 V2 重塑，不行就优雅失败"。

## 功能 (Capabilities)

### 新增功能
- `confidence-circuit-breaker`: 三锁熔断机制 — 静态校验 ERROR 触发强制置信度死线，WARNING 执行刚性梯度扣分，返回 v2_system_alerts 白盒协议
- `llm-temperature-control`: Temperature/Seed 双态差异化配置 — 理性态 T=0.05 + 固定 seed，对抗态 T=0.45 + 随机 seed

### 修改功能
- `pipeline-engine`: 外循环从 MAX_OUTER_LOOP=5 改为仅一次 V2 重塑；Nexus 步骤后插入置信度拦截层（标签→基准分→梯度扣分→写回 confidence_level）
- `model-validator`: 扩展 validateModel 新增拓扑完备性校验（孤立节点/断头路）和因果循环检测
- `multi-agent-pipeline`: Nexus prompt 将 `confidence_level`（数值）改为 `confidence_label`（定性标签）

## 影响

- **后端**：`server/services/llmService.js`、`server/routes/decision.js`、`server/prompts/decisionModel.js`
- **共享**：`src/shared/modelValidator.js`、`src/shared/qualitativeMap.js`
- **搬迁**：`src/engines/probNormalizer.js` → `src/shared/probNormalizer.js`
- **前端**：`src/components/decision/DevilReview.vue` — 融合 v2_system_alerts 红牌卡片（可选，可在后续变更中完成）

## 非目标

- 不改变 framework、build-model 的 SEE 子管线、devil-model 等步骤的输出结构
- 不修改前端 SSE 消费、localStorage 格式、treeData 结构
- 不引入新的外部依赖
- 不改变 Monte Carlo 仿真引擎的数学逻辑
