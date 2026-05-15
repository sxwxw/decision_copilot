## 新增需求

### 需求:DEVIL 对抗审查 Agent

系统 SHALL 提供 DEVIL Agent，接收当前的决策模型数据，输出结构化审查结果。

#### 场景:审查输出挑战列表
- **当** DEVIL Agent 分析完成
- **那么** 输出包含 `challenges` 数组，每项含 id、severity（critical/moderate/minor）、target、title、issue、evidence、impact、recommendation

#### 场景:审查标记偏置
- **当** DEVIL Agent 检测到模型中的认知偏置
- **那么** 输出 `bias_flags` 数组，每项含 type、description、severity

#### 场景:识别冠军脆弱假设
- **当** 排名第一的选项存在关键假设
- **那么** 输出 `winner_vulnerability` 对象，含 option、most_likely_disappointment、impact

### 需求:审查结果展示

系统 SHALL 在底部面板的"审查"tab 中展示 DEVIL 输出。

#### 场景:展示挑战列表
- **当** 审查完成且存在 challenges
- **那么** 按 severity 排序展示每个挑战，包含标题、问题描述、影响和建议

#### 场景:无挑战时展示
- **当** 审查完成但无 challenges
- **那么** 展示空状态提示（如"未发现明显问题"）

### 需求:自动触发审查

系统 SHALL 在深度模拟（蒙特卡洛）完成后自动触发 DEVIL 审查。

#### 场景:自动触发
- **当** 蒙特卡洛仿真完成且结果可用
- **那么** 自动调用 DEVIL Agent，在后台异步运行

#### 场景:手动重新审查
- **当** 用户点击"重新审查"按钮
- **那么** 重新调用 DEVIL Agent 进行审查
