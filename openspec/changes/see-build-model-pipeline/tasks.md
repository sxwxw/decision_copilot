## 1. SEE Prompt 与 DSL 定义

- [x] 1.1 在 `server/prompts/decisionModel.js` 中新增 `DECISION_SEE_STEP1_PROMPT`（变量与参数细化），输出 `## VARIABLES_START ##` DSL 格式
- [x] 1.2 在 `server/prompts/decisionModel.js` 中新增 `DECISION_SEE_STEP2_PROMPT`（因果树推演），输出 Markdown 缩进树 + `[PAYLOAD]` 格式
- [x] 1.3 在 `server/prompts/decisionModel.js` 中新增 `DECISION_SEE_STEP3_PROMPT`（路径演绎与推荐），输出 `## PATHS_START ##` / `## SCORES_START ##` / `## RECOMMENDATION_START ##` DSL 格式

## 2. SEE Parser 实现

- [x] 2.1 创建 `server/parsers/seeParser.js`，实现 `parseVariables(rawText)` — 解析 `## VARIABLES_START ##` 块，返回 `{ variables, weights }`
- [x] 2.2 实现 `parseCausalTree(rawText)` — 基于正则（`- Variable:` / `- Option:` / `- Event:` / `- State:`）解析缩进树，返回 `treeData` 嵌套结构，包含 `[PAYLOAD]` 块解析
- [x] 2.3 实现 `parsePaths(rawText)` — 解析 `## PATHS_START ##` 到 `## PATHS_END ##` 块，返回 `paths` 数组（含 timeline）
- [x] 2.4 实现 `parseScores(rawText)` — 解析 `## SCORES_START ##` 块，返回 `scores` 对象
- [x] 2.5 实现 `parseRecommendation(rawText)` — 解析 `## RECOMMENDATION_START ##` 块，返回 `recommendation` 对象
- [x] 2.6 实现 `assembleModel(step1Raw, step2Raw, step3Raw, framework)` — 调用上述解析器，组装完整 JSON（含 options 取自 framework）
- [x] 2.7 为 Parser 添加容错逻辑：行首空格 trim、缺失字段默认值填充、关键字行匹配而非精确缩进计数
- [x] 2.8 实现 `validateModelStructure(model)` — 结构级校验，检查 treeData 嵌套完整性、logic_payload 分布（非叶子节点必须有、叶子节点禁止有）、paths 的 impact key 与 variables 匹配、probability_label/delta_label 枚举值合法
- [x] 2.9 将结构校验接入管线：在 Parser 组装完成后、validateModel() 之前执行，结构校验失败直接中断管线并返回错误

## 3. 管线集成 — SEE 子管线编排

- [x] 3.1 在 `server/routes/decision.js` 中新增 `executeSeeSubPipeline()` 函数，串行调用 Step 1 → Step 2 → Step 3 → Parser
- [x] 3.2 在 SEE 子步骤间发送 SSE `event:status` 事件（`see-step-running` / `see-step-completed`）
- [x] 3.3 修改 `PIPELINE_STEPS` 中 build-model 的执行逻辑：用 `executeSeeSubPipeline()` 替代原单次 `callQwen`
- [x] 3.4 确保 build-model SSE `event:step` completed 事件在 SEE 全部完成（含 Parser）后发送
- [x] 3.5 在 Mock 模式下为 SEE 3 个子步生成模拟 DSL 文本

## 4. 内循环精确弹回

- [x] 4.1 修改 `devil-model` 步骤的 LLM prompt，要求在输出中增加 `target_step` 字段（1/2/3）
- [x] 4.2 实现 `determineTargetStep(devilReview)` — 从 Devil-model 审查报告提取 target_step，若无明确标签则默认 1
- [x] 4.3 实现级联顺延逻辑：`if target_step <= 1 { runStep1; markStale(2); markStale(3) }` / `if target_step <= 2 { runStep2; markStale(3) }` / `runStep3`
- [x] 4.4 修改内循环触发逻辑：从"回退到 build-model"改为"根据 target_step 精确定位 SEE 子步并重跑 + 顺延"
- [x] 4.5 确保内循环仍保持"最多执行 1 次"的约束

## 5. 外循环全局重塑

- [x] 5.1 实现 `buildDefeatContextForSee(allSteps)` — 构建 Nexus 失效原因，包装为"全局环境约束"
- [x] 5.2 在外循环重跑 build-model 时，将败因上下文注入 SEE Step 1、Step 2、Step 3 的 prompt
- [x] 5.3 外循环重跑时清除 SEE 所有中间状态（version 递增），从 Step 1 完整重跑

## 6. 状态持久化

- [x] 6.1 扩展 `pipelineState` 结构，新增 `seeStep1` / `seeStep2` / `seeStep3` 字段（含 raw_text、parsed_json、status、version）
- [x] 6.2 每个 SEE 子步完成后将结果写入 pipelineState，标记 status 为 frozen/stale
- [x] 6.3 修改 `GET /pipeline/:id` 端点，返回 SEE 子步的中间状态
- [x] 6.4 修改 `POST /pipeline/:id/resume` 端点，跳过已完成且 frozen 的 SEE 子步

## 7. 验证时机调整

- [x] 7.1 将 `validateModel()` 调用时机从"单次 LLM 输出后"移至"SEE Parser 组装完成后"
- [x] 7.2 确保 V2 外回路中 validateModel 在 SEE 重跑后仍被正确触发

## 8. 端到端验证

- [ ] 8.1 使用真实 LLM 跑一次完整管线，验证 SEE 3 步子管线端到端输出
- [ ] 8.2 验证内循环精确弹回（模拟 target_step=3 场景，确认 Step 1+2 不被重跑）
- [ ] 8.3 验证外循环全局重塑（模拟 Nexus 置信度 < 60，确认 SEE 从 Step 1 重跑）
