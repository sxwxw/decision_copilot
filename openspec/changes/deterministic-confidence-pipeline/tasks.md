# Tasks: deterministic-confidence-pipeline

## 1. 基础设施 — 文件搬迁

- [x] 1.1 将 `src/engines/probNormalizer.js` 搬迁至 `src/shared/probNormalizer.js`，确保前后端共享归一化算法
- [x] 1.2 更新所有 import 引用：`src/shared/modelValidator.js`、前端引擎中的引用

## 2. Nexus Prompt 改造 — confidence_label 替换 confidence_level 数值

- [x] 2.1 修改 `DECISION_NEXUS_PROMPT`：将 `"confidence_level": <0-100的数值>` 替换为 `"confidence_label": "极高/高/中/低/极低"`
- [x] 2.2 修改 `DECISION_NEXUS_PROMPT`：新增 `confidence_score` 字段说明（LLM 输出 0，由后端代码注入真实数值）
- [x] 2.3 检查 SEE Step 1/2/3 prompt 中是否残留"附带概率数值"的过时提示词，予以清除

## 3. 三锁熔断 — 拦截层与梯度扣分

- [x] 3.1 在 `executePipelineSteps` 的 nexus 步骤完成后，插入置信度拦截层：优先读取 `result.confidence_label` 查表为基准分；若不存在则回退到 `result.confidence_level` 数值（双轨兜底）
- [x] 3.2 实现蒙特卡洛不收敛检测：sigma/mean > 0.40 → WARNING 扣 3 分；仿真崩溃/空结果 → ERROR 锁死 15 分
- [x] 3.3 实现梯度扣分公式：收集 WARNING 列表（TOPOLOGY_LOOP -5、SIMULATION_OSCILLATION -3、MINIMAL_DATA_MISSING -2），从基准分中扣减
- [x] 3.4 实现 ERROR 强制死线：结构 ERROR → `Math.min(original, 45)`；结构+仿真同时 ERROR → 锁死 15
- [x] 3.5 将最终数值写回 `result.confidence_level`，确保外循环判断和前端展示可正确读取
- [x] 3.6 实现 `v2_system_alerts` 协议组装，包含 `type`、`severity`、`message`、`override_details`

## 4. Model Validator 扩展 — 拓扑完备性与因果循环检测

- [x] 4.1 在 `validateModel()` 中新增拓扑完备性校验：检测孤立节点（有父无子/有子无父，非叶子/非根）
- [x] 4.2 在 `validateModel()` 中新增断头路检测：路径中途终止且无终审损益表现
- [x] 4.3 在 `validateModel()` 中新增因果循环检测：DFS/BFS 遍历 treeData 检测 A → B → C → A 环路
- [x] 4.4 因果循环返回 `severity: "warning"` 而非 "error"，在错误信息中标识涉及的节点路径

## 5. LLM Service 层 — Temperature/Seed 双态差异化

- [x] 5.1 修改 `callQwen()` 函数签名，新增可选 `mode` 参数（`rational` | `adversarial` | 默认 undefined）
- [x] 5.2 在 `callQwen()` 内部实现 mode → temperature/seed 映射逻辑：rational 用 T=0.05 + 固定 seed，adversarial 用 T=0.45 + 随机 seed，无 mode 保持 T=0.7 向后兼容
- [x] 5.3 在 `PIPELINE_STEPS` 定义中为每个 step 添加 `mode` 字段

## 6. 管线调度层 — Mode 注入与 SEE 子步适配

- [x] 6.1 修改 `executePipelineSteps` 中 `callQwen` 调用，传入 `step.mode`
- [x] 6.2 修改 `executeSeeSubPipeline` 中的 3 次 `callQwen` 调用，传入 `mode: 'rational'`
- [x] 6.3 验证 legacy 端点（`/model`、`/simulate`、`/refine`）的 `callQwen` 调用保持向后兼容

## 7. 外循环语义变更 — 从 5 次改为 1 次 V2 重塑

- [x] 7.1 将 `MAX_OUTER_LOOP` 从 5 改为 1
- [x] 7.2 验证外循环逻辑：V1 出低分 → 触发 V2；V2 仍低分 → 设置 `outerLoopLowConfidence = true`，结束管线
- [x] 7.3 验证 V2 重塑中的 SEE 清理逻辑（`delete state.seeStep1/2/3`）正常工作

## 8. 验证与收尾

- [x] 8.1 验证前端 `NexusReport.vue` 读取 `confidence_level` 字段不受后端拦截层影响
- [x] 8.2 验证外循环判断条件 `confidence < 60` 在拦截层写回数值后正确触发
- [x] 8.3 删除已搬迁的 `src/engines/probNormalizer.js` 原文件
