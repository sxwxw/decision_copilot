## 移除需求

### 需求:probability_factor 字段

`risk_adjustment` 中的 `probability_factor` 字段必须移除。LLM 在生成 `risk_adjustment` 时，每个风险偏好类型（保守/均衡/激进）仅包含 `offset` 字段，不得包含 `probability_factor`。

#### 场景:LLM 生成 risk_adjustment
- **当** LLM 为选项生成 `risk_adjustment` 字段
- **那么** 每个风险偏好类型仅包含 `offset`，不包含 `probability_factor`

#### 场景:仿真器读取 risk_adjustment
- **当** 仿真器读取 `risk_adjustment` 计算效用值
- **那么** 仅使用 `offset` 直接加到效用值上，不读取 `probability_factor`

## 修改需求

### 需求:risk_adjustment 结构

`risk_adjustment` 对象必须包含三个键（保守、均衡、激进），每个键的值是仅含 `offset`（数字）的对象。

#### 场景:均衡型风险偏好
- **当** 用户风险偏好为"均衡"
- **那么** `offset` 必须为 0，表示不偏袒任何选项

#### 场景:保守型风险偏好
- **当** 用户风险偏好为"保守"
- **那么** 低风险选项的 `offset` 为正值，高风险选项的 `offset` 为负值

#### 场景:激进型风险偏好
- **当** 用户风险偏好为"激进"
- **那么** 高风险选项的 `offset` 为正值，低风险选项的 `offset` 为负值
