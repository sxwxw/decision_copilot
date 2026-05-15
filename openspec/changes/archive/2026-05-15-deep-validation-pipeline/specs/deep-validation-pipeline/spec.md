## 新增需求

### 需求:基于已有模型的 5 步流水线深度验证

系统 SHALL 支持基于已有决策模型的 5 步流水线深度验证。当 `/full-pipeline` 接收到 `currentModel` 参数时， SHALL 切换为深度验证模式，在已有模型基础上逐步深化，保持 options 列表和 weights 权重不变。

#### 场景:深度验证模式激活
- **当** `/full-pipeline` 接收到的请求体包含 `currentModel` 字段
- **那么** 进入深度验证模式，FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS 每步都将 `currentModel` 作为上下文约束注入

#### 场景:深度验证保持已有结构
- **当** MODEL-BUILD 步骤在深度验证模式下执行
- **那么** 输出的 options 列表和 weights 权重必须与输入的 `currentModel` 完全一致

#### 场景:快速模式不受影响
- **当** `/full-pipeline` 接收到的请求体不包含 `currentModel` 字段
- **那么** 按原有行为执行，从头开始 5 步流水线

### 需求:流水线进度 SSE 推送

深度验证模式 SHALL 复用 `/full-pipeline` 的 SSE 推送机制。

#### 场景:SSE 推送深度验证步骤状态
- **当** 深度验证流水线执行到某一步
- **那么** 发送 SSE 事件：`{ step: <name>, status: "running" | "done" | "error", data: ... }`

## 修改需求

### 需求:5 步流水线

`multi-agent-pipeline` 中的 5 步流水线 SHALL 支持可选的 `currentModel` 上下文注入。

#### 场景:流水线逐步执行（带上下文）
- **当** 流水线接收到 `currentModel` 参数
- **那么** FRAMEWORK 步骤参考已有维度进行细化，MODEL-BUILD 步骤保持 options/weights 不变

## 移除需求

### 需求:深度验证单步调用

**Reason**: 单步 LLM 调用（`/deep-validation` → `DECISION_VALIDATE_PROMPT`）缺乏多 Agent 渐进式校验的严谨性，被 5 步流水线深度验证取代

**Migration**: 前端改为调用 `runPipeline()` 复用 `/full-pipeline` 的 SSE 流式实现；后端移除 `/deep-validation` 路由和 `DECISION_VALIDATE_PROMPT`
