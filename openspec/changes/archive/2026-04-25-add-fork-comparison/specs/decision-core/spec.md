## ADDED Requirements

### 需求:中间节点 logic_payload 元数据

系统 SHALL 在 LLM 建模时为 treeData 中每个中间节点（非叶子节点，即有 children 的节点）生成 `logic_payload` 字段，包含该分叉路口的结构化决策元数据。

#### 场景:LLM 生成中间节点 logic_payload
- **当** LLM 构建决策树时遇到有 children 的中间节点
- **那么** 系统 SHALL 为该节点生成 logic_payload 字段，包含 key_impact（string）、risk_level（"低"/"中"/"高"）、primary_reason（string）、trade_offs（数组）、opportunity_cost（string）

#### 场景:叶节点不包含 logic_payload
- **当** 节点没有 children（叶节点）
- **那么** 该节点 SHALL 不包含 logic_payload 字段

## MODIFIED Requirements

### 需求:路径详情

系统 SHALL 在用户点击决策树节点后展示路径详情。路径详情 SHALL 根据节点类型自动选择展示模式：
- 叶节点（无 children）：路径溯源视图，包含从根到该节点的完整路径链、timeline 详情、AI 推演结论
- 中间节点（有 children 且非根）：分叉对比视图，展示从该节点出发的各子分支并排对比卡片 + 前端模板拼接的决策建议
- 根节点：全局概览视图，展示所有方案的名称、分值和推荐排序

系统 SHALL 根据节点 step 值和 children 属性自动判断视图模式，禁止用户手动切换。

#### 场景:点击叶节点展示路径溯源
- **当** 用户点击无 children 的叶节点
- **那么** 路径详情面板展示路径链可视化 + timeline 详情 + 解释文本

#### 场景:点击中间节点展示分叉对比
- **当** 用户点击有 children 且非根的中间节点
- **那么** 路径详情面板展示分叉对比视图，并排展示各子分支卡片

#### 场景:点击根节点展示全局概览
- **当** 用户点击决策树根节点
- **那么** 路径详情面板展示所有方案的概览列表
