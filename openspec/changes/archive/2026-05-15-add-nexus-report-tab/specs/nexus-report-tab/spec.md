## 新增需求

### 需求:综合报告 Tab 展示
系统必须在 PathDetail.vue 的概览面板中提供「综合报告」tab，用于展示流水线 NEXUS Agent 生成的综合决策报告。

#### 场景:流水线完成后展示综合报告

- 当用户完成一次流水线执行且 `pipelineNexus` 数据不为空
- 那么点击「综合报告」tab 后展示 executive_summary、recommendation、key_insights、confidence_level、caveats

#### 场景:未运行流水线时的空状态

- 当用户尚未运行流水线或 `pipelineNexus` 为 null
- 那么「综合报告」tab 展示空状态引导文案，提示用户先运行流水线

#### 场景:tab 切换交互

- 当用户点击「综合报告」tab 按钮
- 那么当前概览面板内容切换为 NexusReport 组件渲染结果，其他 tab 内容隐藏

### 需求:置信度数值化
NEXUS Agent 的 `confidence_level` 必须从 `"高|中|低"` 文本升级为 `0-100` 数值。

#### 场景:后端传入判断信号

- 当后端调用 NEXUS LLM 时
- 那么 userPrompt 中必须包含分差、审查问题数量统计、rank flips 次数、概率总和

#### 场景:前端按阈值分级渲染

- 当 `confidence_level` 数值 >85 时
- 那么前端展示绿色细线条样式及"直接决策"操作引导
- 当 `confidence_level` 数值在 60-85 之间时
- 那么前端展示黄色警示图标及"人工核验"操作引导
- 当 `confidence_level` 数值 <60 时
- 那么前端展示橙红/灰色虚线框样式及"重置模型"操作引导
