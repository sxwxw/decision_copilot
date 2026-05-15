## 上下文

当前系统有 3 个并列入口（提交建模、多 Agent 流水线、深度模拟）。多 Agent 流水线只接收 `userInput`，从头开始 5 步生成，完全无视页面上已存在的模型。深度模拟是唯一一个参考当前模型上下文的操作。用户困惑该点哪个，且每次深入分析都"另起炉灶"，破坏了用户对"同一个决策正在持续推演"的信任感。

## 目标 / 非目标

**目标：**
- 将多 Agent 流水线改造为基于当前模型的"深度验证"能力
- 去掉独立的"深度模拟"按钮
- 形成"快速建模 → 调参 → 深度验证"的渐进式路径
- 新增"重新生成模型"弱入口，用于用户对当前模型完全不满意时重开

**非目标：**
- 不改变蒙特卡洛仿真、DEVIL 审查、敏感性分析的核心逻辑
- 不改变快速建模的 prompt 和接口
- 不改变参数面板的交互方式
- 不删除已有的 `/simulate` 和 `/full-pipeline` 接口（保持向后兼容）

## 决策

### 1. 前端：移除深度模拟按钮，改造多 Agent 按钮

- **决策**：在 `ParamPanel.vue` 中移除"深度模拟"按钮，在 `DecisionView.vue` 中将"多 Agent 流水线"按钮改为"深度验证"按钮
- **理由**：消除功能重叠，简化用户选择
- **替代方案**：保留 3 个按钮但加引导文案——不够彻底，用户仍然困惑

### 2. 后端：新增 `/deep-validation` 路由

- **决策**：新增独立路由，接收 `currentModel` + `userInput`，调用 `DECISION_VALIDATE_PROMPT`（基于已有模型的增强 prompt）
- **理由**：独立路由比修改现有 `/full-pipeline` 更安全，不破坏已有调用方；`DECISION_VALIDATE_PROMPT` 约束 LLM 保持 options/weights 不变，只补充 sim_spec、扩展路径、修复漏洞
- **替代方案**：修改 `/full-pipeline` 增加可选的 `currentModel` 参数——改动更大，且原流水线仍有独立使用场景

### 3. 前端：新增 `runDeepValidation()` 方法

- **决策**：在 `useDecisionModel.js` 中新增方法，调用 `/deep-validation` API，收到结果后更新 `state.model`，自动触发蒙特卡洛仿真和 DEVIL 审查
- **理由**：与现有 `runDeepSimulation()` 模式一致，复用已有的 sanitizeModel + adaptTree + 自动仿真审查流程
- **替代方案**：复用 `runPipeline()` —— 但流水线是 SSE 流式返回，验证是单次请求返回，模式不同

### 4. 新增 `DECISION_VALIDATE_PROMPT`

- **决策**：新建 prompt，明确约束：
  - 保持 `options` 列表和 `weights` 不变
  - 为每个变量补充 `sim_spec`
  - 扩展路径推演（增加新的事件节点）
  - 修复 DEVIL 审查发现的问题
  - 返回完整 model 结构
- **理由**：与 `DECISION_REFINE_PROMPT` 类似但更强调"验证"而非"参数调优"
- **替代方案**：复用 `DECISION_REFINE_PROMPT` —— 但 refine 侧重参数调优，验证侧重模型补全和审查

## 风险 / 权衡

**[风险]** 基于当前模型做深度验证，如果当前模型质量很差（LLM 第一次输出不理想），增强后可能仍然存在问题。
**[缓解]** 提供"重新生成模型"弱入口，用户可以重头开始。

**[风险]** 新增 `/deep-validation` 路由增加后端复杂度。
**[缓解]** 路由逻辑与现有 `/simulate` 类似，复用 `callQwen` + `sanitizeModel` 流程，新增代码量少。

**[权衡]** 保留 `/full-pipeline` 接口向后兼容，但主 UI 不再使用它。
**[理由]** 避免破坏性变更，如果后续有直接调用该接口的场景仍可工作。
