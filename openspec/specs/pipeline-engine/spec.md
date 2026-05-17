## 修改需求

### 需求:Pipeline 多步骤执行
系统 SHALL 执行 9 步骤对抗性管线（framework → devil-framework → build-model → devil-model → simulate → devil-simulate → devil-nexus → nexus），支持内回路和外回路的自适应生命周期。

#### 场景:build-model 后触发定量校验
- **当** build-model 步骤完成
- **那么** 系统 MUST 立即调用 `validateModel()` 对结果进行校验，并将结果存储到 pipelineState 中

#### 场景:DEVIL 步骤接收定量校验上下文
- **当** 执行 devil-model 或 devil-simulate 步骤
- **那么** 传递给 LLM 的 userPrompt 中 MUST 包含定量校验结果（validationResults）

#### 场景:内回路因定量错误触发
- **当** devil-model 步骤完成后，校验结果包含 error 级别问题或概率相关 warning
- **那么** 系统 MUST 触发内回路回溯，回退至 build-model 步骤，将校验错误注入为修正指令

#### 场景:内回路最多执行 1 次
- **当** 内回路已执行过一次
- **那么** 即使再次检测到 CRITICAL 或定量错误，系统 MUST 跳过内回路，记录 innerLoopSkipped = true

#### 场景:V2 外回路执行静态校验
- **当** 外回路触发 V2 build-model
- **那么** 新模型生成后 MUST 立即调用 validateModel()，收集所有 error

#### 场景:V2 外回路信号压制
- **当** V2 校验发现 error 级别问题
- **那么** 系统在置信度信号池中注入"**数据异常报警**"标记

#### 场景:V2 外回路置信度强制锁死
- **当** V2 nexus 完成后校验仍有 error
- **那么** 系统 MUST 将 confidence_level 强制设置为 40（若原值高于 40）
