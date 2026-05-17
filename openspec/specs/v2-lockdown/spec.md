## 新增需求

### 需求:V2 外回路三锁机制
当管线进入外回路（置信度 < 60% 触发 V2 重塑）时，系统 MUST 执行三重防御：静态代码验证、置信度信号压制、Nexus 显式批判。

#### 场景:第一锁 - V2 静态代码验证
- **当** V2 build-model 步骤生成新模型
- **那么** 系统 MUST 立即调用 `validateModel()`，收集所有 error 和 warning 级别结果

#### 场景:第二锁 - 信号强力压制
- **当** V2 模型校验发现 error 级别问题
- **那么** 系统在置信度信号池中注入"**数据异常报警**"标记，并在 Nexus 生成后强制将 `confidence_level` 设置为 40（若原值高于 40）

#### 场景:第三锁 - Nexus 显式批判
- **当** 校验结果包含 error 或关键 warning
- **那么** 系统 MUST 将校验错误信息注入 Nexus Prompt，使终审 Agent 能在报告中对该模型的量化基础进行批判

### 需求:V2 管线精简
外回路重塑管线 MUST 仅包含 build-model → simulate → nexus 三个步骤，裁剪所有中间 Devil 轮次。

#### 场景:V2 管线不包含 Devil 步骤
- **当** 外回路触发 V2 重塑
- **那么** 管线跳过 devil-framework、devil-model、devil-simulate、devil-nexus 四个步骤
