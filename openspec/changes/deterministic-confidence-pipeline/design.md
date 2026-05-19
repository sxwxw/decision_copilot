## 上下文

当前决策管线的置信度（`confidence_level`）完全由 LLM 在 Nexus 步骤中直接输出 0-100 数字，后端代码不参与计算。加上 `callQwen` 中固定 `temperature: 0.7` 且无 seed，导致同一问题多次运行出现 80% vs 25% 的随机抖动。现有 `sanitizeModel` 和 `qualitativeMap.js` 已实现概率标签的双轨解析和归一化，但 Nexus 阶段仍使用数值打分。

## 目标 / 非目标

**目标：**
- 同题同分：只要 LLM 语义判断一致，置信度分数必须一致
- 可解释：分数变化可追溯到具体的锁触发或 WARNING 扣分
- 零断裂：前后端数据契约不变，前端 `NexusReport.vue` 无需大改

**非目标：**
- 不改变 SEE 子管线、framework、devil-model 等步骤的 JSON 结构
- 不修改前端 SSE 消费和 localStorage 格式
- 不引入新的外部依赖

## 决策

### 1. Temperature/Seed 差异化 — 管线层注入，底层无感知

**选择**：`callQwen` 新增可选 `mode` 参数（`rational` | `adversarial`），管线 `PIPELINE_STEPS` 定义中为每个 step 声明 mode，调度器调用时传入。

**理由**：`llmService.js` 应保持无状态工具属性，不知道当前跑的是哪一步。控制权在管线调度器手里。理性态（framework、build-model、nexus、SEE 子步）用 T=0.05 + 固定 seed；对抗态（devil-model、devil-simulate、devil-nexus）用 T=0.45 + 随机 seed。

### 2. Nexus 置信度 — 标签化输出 + 后端拦截层

**选择**：Nexus LLM 输出 `confidence_label`（极高/高/中/低/极低），不输出数值。`llmService` 返回后、写入 `pipelineState` 前，插入拦截层：
1. 查表将 `"高"` → 基准分 70
2. 收集管线中的 WARNING 列表，执行梯度扣分
3. 若存在 ERROR，触发第三锁强制死线
4. 将最终数值写回 `result.confidence_level`（外循环判断 + 前端展示复用）

**理由**：外循环判断 `confidence < 60` 和前端 `NexusReport.vue` 都读 `confidence_level` 字段。后端拦截层把这个值算好后覆写，上下游一个字都不用改。

### 3. 梯度扣分公式 — 静态硬编码，LLM 不参与

**选择**：扣分表硬编码在管线调度器中：

| WARNING 类型 | 扣减分数 |
|---|---|
| `TOPOLOGY_LOOP`（因果循环） | 5 分 |
| `SIMULATION_OSCILLATION`（蒙特卡洛不收敛） | 3 分 |
| `MINIMAL_DATA_MISSING`（非核心字段缺失） | 2 分 |

ERROR 触发强制死线：结构 ERROR → 最高 45%；结构 + 仿真同时 ERROR → 锁死 15%。

**理由**：如果让 LLM 自己决定扣几分，情绪化抖动的根源会死灰复燃。扣分必须是纯 JS 刚性执行。

### 4. 因果循环检测 — WARNING 不熔断

**选择**：在 `validateModel` 中新增拓扑环路检测（BFS/DFS），发现循环时返回 `WARNING` 而非 `ERROR`。WARNING 不触发梯度熔断，但写入 `v2_system_alerts` 注入 Nexus 上下文，前端渲染为橙色虚线。

**理由**：某些商业模型天然存在正反馈回路（用户增长 → 营收 → 研发 → 用户增长），不应直接判死刑。

### 5. 外循环从 5 次改为 1 次 V2 重塑

**选择**：`MAX_OUTER_LOOP` 从 5 改为 1。语义从"反复刷到及格"变为"给一次重建机会，不行就优雅失败"。V1 出低分 → 触发 V2；V2 仍低分 → 接受结果交付前端。

**理由**：反复 5 次重塑本质是在"刷分"，消耗 Token 且不会让模型质量本质提升。一次 V2 重建足够覆盖"V1 结构崩塌"的场景。

### 6. v2_system_alerts 协议 — 白盒化错误输出

**选择**：Nexus 返回结果中新增 `v2_system_alerts` 数组，每个元素包含 `{ type, severity, message, override_details }`。前端融合进 `DevilReviewPanel` 顶部，渲染为红牌警告卡片。

**理由**：用户需要理解"为什么分数从 80% 变成了 25%"。系统级审计日志让黑盒变透明。

### 7. probNormalizer 搬迁 — 单源真相

**选择**：从 `src/engines/probNormalizer.js` 搬迁至 `src/shared/probNormalizer.js`。后端 `sanitizeModel` 和前端归一化逻辑共享同一文件。

**理由**：前后端数学公式必须 100% 一致，各自维护会导致"算出来不一样"的灾难。

## 风险 / 权衡

| 风险 | 缓解措施 |
|---|---|
| 标签粒度不足（5 档映射到 0.05-0.90） | 通过 Qualitative Ratio 归一化保持微细差异：`0.70/(0.70+0.70+0.70) = 33.3%` |
| 外循环改为 1 次后，确实需要多次修复的场景无法处理 | 用户可通过 `/correct-model` 手动修正，或重新提交问题 |
| 前端 `DevilReviewPanel` 融合 v2_system_alerts 需要 UI 改动 | 先在后端返回数据，前端可后续迭代。核心管线功能不依赖前端 UI |
| `probNormalizer` 搬迁可能遗漏 import 引用 | 搬迁后全局搜索 `probNormalizer` 引用并更新 |
