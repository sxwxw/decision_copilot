# Spec: multi-agent-pipeline

## 修改需求

### 需求:Pipeline SSE 流管理

系统 SHALL 在 SEE 子管线执行期间，向 SSE 客户端发送细粒度的步骤状态事件，保持与现有 SSE 格式兼容。客户端无需修改 SSE 消费逻辑。

#### 场景:SEE 子步骤状态事件
- **当** SEE 子管线中的某个子步骤开始或完成
- **那么** 系统发送 `event:status` 事件，status 字段为 `"see-step-running"` 或 `"see-step-completed"`，text 字段包含子步骤描述（如 "SEE Step 1/3: 变量与参数细化"）

#### 场景:build-model 完成事件不变
- **当** SEE 子管线全部完成（含 Parser 组装）
- **那么** 系统发送 `event:step` 事件，step 为 `"build-model"`，status 为 `"completed"`，与现有客户端行为一致
