# spec: enhance-path-trace

## 需求

### 数据摘要

- 系统 SHALL 在路径溯源视图中展示"到达总概率：X%"和"综合评分：Y"
- 综合评分 SHALL 基于当前参数值对叶子节点原始 value 进行偏移计算
- 当用户拖动参数滑块时，综合评分 SHALL 实时响应更新

### 路径链中间标注

- 系统 SHALL 在路径链节点之间的箭头上展示 `key_impact`
- 当节点有 `logic_payload.trade_offs` 时，系统 SHALL 在箭头上附加 delta 趋势箭头（↑ 或 ↓），方向由 trade_offs delta 总和决定

### 实时风险评估

- 系统 SHALL 对路径节点的 threshold 计算 `currentValue - threshold` 缺口，选出最负的缺口作为主风险
- 当所有维度达标时，系统 SHALL 显示绿色"稳健"文案
- 当至少一个维度不达标时，系统 SHALL 显示预警文案，指出缺口最大的维度名、当前值、阈值
- 当两个以上维度不达标时，系统 SHALL 显示"风险累计"文案，列出所有不达标维度
- 当节点没有 threshold 或所有 threshold 值为 0 时，系统 SHALL 判定为"无风险环境"，隐藏风险评估区
- 当用户拖动参数滑块时，风险状态（红边/绿边、预警文案） SHALL 实时更新

### 路径级归因

- 系统 SHALL 遍历路径链所有节点的 trade_offs，找到 `(paramValue - 50) × delta` 绝对值最大的环节
- 归因文案格式 SHALL 为"推动力：由于您对「维度」的偏好，[节点名] 环节的贡献被显著放大/缩小"

### 机会成本展示

- 系统 SHALL 在叶子节点的 `logic_payload.opportunity_cost` 存在时，在底部展示机会成本文案

### 数据注入

- 系统 SHALL 在 `selectNode` 被调用时，通过 `enrichPathChain` 将 `matchedPath.timeline` 的 impact/threshold/probability 注入到 pathChain 节点中
- 系统 SHALL 保持 `adaptTree` 不变，不受 `enrichPathChain` 影响
