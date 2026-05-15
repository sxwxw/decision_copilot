# adversarial-pipeline 规范

## 目的
待定 - 由归档变更 elevate-devil-to-adversarial-layer 创建。归档后请更新目的。
## 需求
### 需求:DEVIL 子步骤嵌入流水线执行序列
系统必须在每个主步骤（FRAMEWORK、BUILD-MODEL、SIMULATE、NEXUS）后自动插入对应的 DEVIL 子步骤，形成 9 步执行序列：framework → devil-framework → build-model → devil-model → simulate → devil-simulate → nexus → devil-nexus。

#### 场景:流水线执行包含所有 DEVIL 子步骤
- 当用户触发完整流水线
- 那么系统依次执行 9 个步骤（4 个主步骤 + 4 个 DEVIL 子步骤 + NEXUS 后的最终 DEVIL）
- 那么每个 DEVIL 步骤在前置主步骤完成后自动触发，无需用户干预

#### 场景:DEVIL 步骤跳过主步骤
- 当某个主步骤被跳过（如 SIMULATE 步骤由前端触发真实仿真）
- 那么对应的 DEVIL-SIMULATE 步骤仍必须在仿真完成后触发

### 需求:DEVIL 步骤的上下文传递
系统必须为每个 DEVIL 步骤构建针对性的 userPrompt，传入其前置步骤的输出作为攻击目标。

#### 场景:DEVIL-FRAMEWORK 上下文
- 当执行 devil-framework 步骤
- 那么 userPrompt 必须包含 FRAMEWORK 输出和原始用户问题

#### 场景:DEVIL-MODEL 上下文
- 当执行 devil-model 步骤
- 那么 userPrompt 必须包含 BUILD-MODEL 输出和 FRAMEWORK 输出

#### 场景:DEVIL-SIMULATE 上下文
- 当执行 devil-simulate 步骤
- 那么 userPrompt 必须包含蒙特卡洛仿真结果和当前模型数据

#### 场景:DEVIL-NEXUS 上下文
- 当执行 devil-nexus 步骤
- 那么 userPrompt 必须包含 NEXUS 输出和前面 3 个 DEVIL 步骤的累积输出

