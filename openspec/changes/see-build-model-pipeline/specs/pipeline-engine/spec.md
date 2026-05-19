# Spec: pipeline-engine

## 修改需求

### 需求:Pipeline 多步骤执行

系统 SHALL 执行对抗性管线，其中 build-model 步骤内部由 SEE（Sequential Elaborate Evaluation）子管线实现（3 个 LLM 步骤 + 1 个代码 Parser）。对外暴露的管线步骤名称和 SSE 事件格式保持不变。

#### 场景:build-model 触发 SEE 子管线
- **当** 管线执行到 build-model 步骤
- **那么** 系统依次执行 SEE Step 1（变量与参数细化）→ SEE Step 2（因果树推演）→ SEE Step 3（路径演绎与推荐），最后由代码 Parser 组装完整 JSON

#### 场景:SEE 子步骤完成后触发定量校验
- **当** SEE Parser 组装完成 build-model 最终结果
- **那么** 系统 MUST 立即调用 `validateModel()` 对结果进行校验，并将结果存储到 pipelineState 中

#### 场景:内回路因定量错误触发精确弹回
- **当** devil-model 步骤完成后，审查报告包含 `target_step` 字段标识问题所在的 SEE 子步
- **那么** 系统根据 target_step 执行定点重试：target_step=1 重跑 Step 1 并顺延 2、3；target_step=2 冻结 Step 1 重跑 Step 2 并顺延 3；target_step=3 仅重跑 Step 3

#### 场景:内回路最多执行 1 次
- **当** 内回路已执行过一次
- **那么** 即使再次检测到 CRITICAL 或定量错误，系统 MUST 跳过内回路，记录 innerLoopSkipped = true

#### 场景:V2 外回路执行 SEE 全局重塑
- **当** 外回路触发 V2 build-model
- **那么** 系统清除当前 SEE 所有中间状态，从 Step 1 到 Step 3 完整重跑，并将 Nexus 失效原因注入各步 prompt

#### 场景:V2 外回路执行静态校验
- **当** 外回路触发 V2 build-model
- **那么** SEE Parser 组装新模型后 MUST 立即调用 validateModel()，收集所有 error

#### 场景:V2 外回路置信度强制锁死
- **当** V2 nexus 完成后校验仍有 error
- **那么** 系统 MUST 将 confidence_level 强制设置为 40（若原值高于 40）
