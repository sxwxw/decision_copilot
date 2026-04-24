## 新增需求

### 需求:分叉对比展示关键分歧变量
ForkComparison.vue 必须在分叉卡片区域上方展示导致各子分支选择分歧的关键变量标识。

#### 场景:存在多个子分支且包含 trade_offs
- **当** 当前节点的子分支各自包含 `logic_payload.trade_offs` 数据
- **那么** 系统计算每个维度的 delta 极差（max - min），展示极差最大的维度为关键分歧变量

#### 场景:子分支无 trade_offs 数据
- **当** 子节点无 `logic_payload.trade_offs`，fallback 到父节点的 `trade_offs`
- **那么** 仍计算并展示关键分歧变量

#### 场景:无 trade_offs 数据
- **当** 当前节点及其子分支均无 `logic_payload.trade_offs` 数据
- **那么** 不展示敏感度标识
