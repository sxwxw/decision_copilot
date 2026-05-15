# spec: deep-validation

## 新增需求

### 需求:深度验证入口
系统必须在参数面板区域提供"深度验证"按钮，作为主入口替代原有的"多 Agent 流水线"和"深度模拟"按钮。

#### 场景:点击深度验证按钮
- 当用户点击"深度验证"按钮
- 那么系统调用 `/deep-validation` API，传入当前模型数据和用户原始问题
- 那么按钮显示 loading 状态，禁止重复点击

#### 场景:无模型时点击深度验证
- 当用户尚未建立模型时点击"深度验证"按钮
- 那么系统提示"请先输入决策问题并点击建模"

### 需求:深度验证后端接口
系统必须提供 `POST /api/decision/deep-validation` 端点，接收当前模型上下文并输出增强后的模型。

#### 场景:成功调用深度验证
- 当客户端发送 `{ currentModel, userInput }` 到 `/api/decision/deep-validation`
- 那么服务端调用 LLM，使用 `DECISION_VALIDATE_PROMPT`
- 那么 LLM 必须保持 `options` 列表和 `weights` 不变
- 那么 LLM 必须为每个变量补充 `sim_spec`
- 那么服务端返回增强后的完整 model 结构

#### 场景:缺少必填参数
- 当请求体中缺少 `currentModel` 或 `userInput`
- 那么服务端返回 400 错误

### 需求:深度验证 Prompt
系统必须提供 `DECISION_VALIDATE_PROMPT`，用于指导 LLM 基于已有模型做增强验证。

#### 场景:Prompt 约束
- 当 LLM 接收当前模型数据
- 那么 Prompt 必须明确要求保持 `options` 和 `weights` 不变
- 那么 Prompt 必须要求为每个变量补充 `sim_spec`
- 那么 Prompt 必须要求扩展路径推演（增加新的事件节点）
- 那么 Prompt 必须要求进行对抗性审查（类似 DEVIL 但更温和）

### 需求:前端深度验证流程
系统必须在 `useDecisionModel.js` 中提供 `runDeepValidation()` 方法。

#### 场景:验证成功
- 当 `runDeepValidation()` 收到增强后的 model
- 那么系统调用 `sanitizeModel()` 和 `adaptTree()` 处理返回数据
- 那么系统更新 `state.model` 为增强后的模型
- 那么系统自动触发蒙特卡洛仿真（`runDeepSimulation()` 的仿真部分）
- 那么系统自动触发 DEVIL 审查（`runDevilReview()`）
- 那么系统保存模型到本地存储

#### 场景:验证失败
- 当深度验证 API 调用失败
- 那么系统显示错误提示
- 那么 `state.model` 保持不变

### 需求:重新生成模型入口
系统必须提供"重新生成模型"功能，用于用户对当前模型完全不满意时重开分析。

#### 场景:重新生成模型
- 当用户点击"重新生成模型"按钮
- 那么系统清空当前模型数据（`state.model = null`）
- 那么系统清空参数面板、蒙特卡洛结果、DEVIL 审查结果
- 那么系统保留用户输入框内容，方便重新提交
