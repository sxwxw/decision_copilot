## 为什么

当前 PathDetail.vue 在用户点击决策树节点时，对所有节点类型（根节点、方案节点、中间过程节点、叶节点）使用同一套路径溯源视图。这忽略了中间节点的核心价值 —— 它们是决策分叉路口。点击"白切鸡"这样的方案节点时，用户真正需要的是"从这里出发有哪些路可以走、各自的代价和收益是什么"，而非仅仅是"我到了哪"。同时，现有 treeData 中间节点缺乏 `logic_payload` 字段，无法支撑分叉对比所需的关键元数据。

## 变更内容

- **LLM Prompt 升级**：要求 `decisionModel.js` 为 treeData 中间节点（step >= 1 且有 children）生成 `logic_payload` 字段，包含 `key_impact`、`risk_level`、`primary_reason`、`trade_offs`、`opportunity_cost` 等结构化元数据
- **数据适配器升级**：`adaptTree()` 透传 `logic_payload` 至标准化节点
- **PathDetail 三种视图模式**：
  - **叶节点视图**：完整路径链纵向卡片流 + timeline 详情 + AI 推演结论（由 `refactor-path-detail` 变更提供基础）
  - **分叉对比视图**：点击中间节点/方案节点时，展示从该节点出发的各子分支并排对比卡片（概率/分值/核心代价/价值体现）
  - **全局概览视图**：点击根节点时展示所有方案的概览排序
- **前端模板拼接决策建议**：基于 `logic_payload` 元数据 + 用户偏好参数，前端动态生成决策建议文本
- **新组件 ForkComparison.vue**：独立的分叉对比视图组件

## 功能 (Capabilities)

### 新增功能
- `fork-comparison`: 中间节点分叉对比视图 —— 并排展示从当前节点出发的各分支走向，对比概率/分值/代价/收益
- `logic-payload`: treeData 中间节点增加结构化决策元数据字段

### 修改功能
- `decision-core`: LLM Prompt 生成中间节点 `logic_payload`；前端路径详情面板支持三种视图模式切换

## 影响

- `server/prompts/decisionModel.js`：prompt 新增 logic_payload 要求
- `useDecisionModel.js`：`adaptTree` 透传 logic_payload
- `PathDetail.vue`：新增视图模式判断逻辑
- `ForkComparison.vue`：新组件（对比卡片 + 前端模板拼接建议）
- 需要更新 mock 数据以包含 logic_payload 字段
