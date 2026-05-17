## 新增需求

### 需求:inner-loop-correction

系统 SHALL 在 devil-model 步骤中输出结构化修正指令。当 `requires_refactor` 为 true 且 `severity` 为 "CRITICAL" 时，系统 SHALL 自动回溯到 build-model 步骤重新建模，将 devil-model 的指令集作为约束注入。内回路 SHALL 最多执行 1 次，超过则标记为 `inner-loop-skipped` 并继续下游步骤。

#### 场景:devil-model 发现关键问题触发内回路

- **当** devil-model 返回 `requires_refactor: true` 且 `severity: "CRITICAL"`
- **那么** 系统回溯到 build-model 步骤，传入修正指令，重新建模

#### 场景:内回路已执行过一次不再触发

- **当** 内回路已执行 1 次且 devil-model 再次返回 CRITICAL 级别修正指令
- **那么** 系统标记为 `inner-loop-skipped`，继续执行下游步骤

### 需求:outer-loop-correction

系统 SHALL 在 nexus 步骤完成后评估置信度。当 `confidence_level` < 60 时，系统 SHALL 从 build-model 步骤开始重跑整条管线（含 simulate 仿真），将"败因上下文"（蒙特卡洛结果 + 所有 devil 审查意见）注入 build-model prompt。外回路 SHALL 最多执行 1 次。

#### 场景:置信度低时触发外回路

- **当** nexus 步骤返回 `confidence_level` < 60 且外回路尚未执行
- **那么** 系统从 build-model 开始重跑管线，包含仿真步骤

#### 场景:外回路已执行一次不再触发

- **当** nexus 步骤返回 `confidence_level` < 60 但外回路已执行过 1 次
- **那么** 系统不再重跑，管线以当前结果完成

### 需求:defeat-context

外回路触发时，系统 SHALL 构建"败因上下文"，包含：蒙特卡洛仿真排名及 P10/P50/P90 矩阵、所有 devil 阶段的高级别质疑、nexus 的置信度判断理由。败因上下文 SHALL 作为约束注入重跑的 build-model prompt。

#### 场景:构建败因上下文

- **当** 外回路被触发
- **那么** 系统收集蒙特卡洛结果、所有 devil 意见、nexus 置信度理由，合为败因上下文

### 需求:manual-correction

系统 SHALL 在管线完成后提供手动修正入口。用户点击"重新建模"按钮后，系统 SHALL 调用 `POST /api/decision/correct-model` 接口，传入当前 `pipelineId`。

#### 场景:手动触发模型修正

- **当** 用户点击"重新建模"按钮
- **那么** 系统调用 /correct-model API，加载修正后的模型并更新 UI

### 需求:correct-model-api

系统 SHALL 提供 `POST /api/decision/correct-model` 端点。请求体 SHALL 包含 `pipelineId`。系统 SHALL 从 `pipelineState` 中读取该管线的所有上下文，执行修正逻辑并返回修正后的模型。

#### 场景:成功修正模型

- **当** 收到包含有效 pipelineId 的修正请求
- **那么** 系统返回修正后的模型 JSON

#### 场景:管线不存在

- **当** 请求的 pipelineId 在 pipelineState 中不存在
- **那么** 系统返回 404 错误

## 修改需求

### 需求:devil-model-output

系统 SHALL 在 devil-model 步骤中强制输出结构化 JSON，包含 `requires_refactor`（布尔值）、`severity`（CRITICAL/HIGH/MEDIUM/LOW）、`target_dimension`（受影响的维度名）、`reason`（原因说明）、`suggested_value_range`（建议值范围）。禁止仅输出纯文本审查意见。

#### 场景:devil-model 输出结构化修正指令

- **当** devil-model 步骤执行完成
- **那么** 返回的 JSON 包含 requires_refactor、severity、target_dimension 等字段

### 需求:管线步骤

系统 SHALL 在管线中支持内回路（build-model ↔ devil-model 回溯）和外回路（nexus → build-model 重跑）。内回路 SHALL 在 devil-model 之后判断是否回溯；外回路 SHALL 在 nexus 之后根据置信度决定是否从 build-model 重跑。

#### 场景:内回路执行

- **当** devil-model 返回 CRITICAL 级别修正指令且内回路未执行过
- **那么** 系统回溯到 build-model 重新建模

#### 场景:外回路执行

- **当** nexus 返回置信度 < 60 且外回路未执行过
- **那么** 系统从 build-model 开始重跑整条管线

### 需求:loading-feedback

系统 SHALL 在管线执行过程中根据当前阶段动态更新 loading 文案。当内回路触发时，系统 SHALL 发送 SSE `status` 事件通知前端"发现关键问题，正在自我校准..."；当外回路触发时，系统 SHALL 发送 SSE 事件通知前端"置信度不足，正在重塑模型..."；正常执行阶段文案为"AI 正在推演中..."。

#### 场景:内回路触发时更新 loading 文案
- **当** 内回路被触发
- **那么** 系统发送 SSE status 事件，前端显示"发现关键问题，正在自我校准..."

#### 场景:外回路触发时更新 loading 文案
- **当** 外回路被触发
- **那么** 系统发送 SSE status 事件，前端显示"置信度不足，正在重塑模型..."

#### 场景:正常执行阶段 loading 文案
- **当** 管线处于正常执行状态且无回路触发
- **那么** 前端显示"AI 正在推演中..."
