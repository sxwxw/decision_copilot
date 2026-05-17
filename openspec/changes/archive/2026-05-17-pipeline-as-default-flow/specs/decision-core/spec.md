## 新增需求

### 需求:monte-carlo-backend

系统 SHALL 在后端管线的 `simulate` 步骤中执行蒙特卡洛仿真计算，而非跳过。
系统 SHALL 将仿真结果存入 `pipelineState.steps.simulate`，供后续 devil-simulate 和 nexus 步骤消费。
系统 SHALL 在仿真计算中使用 build-model 步骤输出的变量分布、权重、选项和 trade_offs。
系统 SHALL 在仿真计算中接收前端传入的风险偏好参数。

#### 场景:simulate 步骤执行蒙特卡洛计算

- **当** 管线执行到 simulate 步骤
- **那么** 系统从 pipelineState 读取 build-model 结果，执行 5000 次蒙特卡洛采样
- **并且** 将结果（optionResults, ranking）存入 pipelineState.steps.simulate

#### 场景:devil-simulate 消费仿真结果

- **当** devil-simulate 步骤执行时
- **那么** prompt 上下文应包含 pipelineState.steps.simulate 中的蒙特卡洛排名和统计指标

#### 场景:前端读取仿真结果

- **当** 管线完成后，前端解析 `data.steps.simulate`
- **那么** 系统将其赋值给 `state.monteCarloResult`，确保 UI 正常展示

## 修改需求

### 需求:输入区

系统 SHALL 提供多行文本输入框用于用户描述决策问题。
系统 SHALL 提供风险偏好选择控件。
系统 SHALL 在用户提交输入后触发多 Agent 管线流程，而非单次 LLM 建模调用。
系统 SHALL 在管线执行期间显示加载状态和进度信息。
系统 SHALL 将用户选择的风险偏好随管线请求一并发送至后端。

#### 场景:用户提交决策问题

- **当** 用户输入至少 5 个字符（含中文）的决策问题并点击提交
- **那么** 系统触发多 Agent 管线流程（quick-build 模式），并附带风险偏好参数

#### 场景:输入内容不合法

- **当** 用户输入内容少于 5 个字符或不包含中文字符
- **那么** 系统不触发管线，并显示相应的提示信息

### 需求:计算分工

系统 SHALL 在后端通过多 Agent 管线完成首次决策建模，含管线内嵌的蒙特卡洛仿真。
系统 SHALL 在前端完成用户调参后的本地权重重算（秒级响应）。
前端本地重算 SHALL 采用差异化敏感度公式：`adjusted[方案] = clamp(baseScore[方案] + Σ((paramValue[维度]/100 - 0.5) × delta[方案][维度] × 2), 0, 100)`。
其中 delta 取自该方案节点 `logic_payload.trade_offs` 数组中对应维度的值。
前端本地重算 SHALL 可能导致方案间排序发生变化。
当存在 `snapshotWeights` 时，系统 SHALL 使用增量偏移公式计算：`shift = (currentValue - snapshotValue) / 100 × delta × 2`。

#### 场景:首次建模

- **当** 用户提交决策问题
- **那么** 系统通过多 Agent 管线（而非单次 LLM 调用）生成决策模型并完成蒙特卡洛仿真

## 移除需求

### 需求:输入区（旧版单次建模）

**Reason**: 多 Agent 管线已替代单次 LLM 建模作为唯一入口，不再需要独立的快速建模路径
**Migration**: 用户提交行为统一走 `/api/decision/full-pipeline` 管线端点，由 `runPipeline` 函数触发
