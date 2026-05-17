# spec: sensitivity-engine

## 新增需求

### 需求:敏感性分析引擎

系统 SHALL 提供独立的敏感性分析引擎，对每个选项的 trade_off 维度进行 ±20% 扰动，计算排名稳定性。

#### 场景:正常敏感性分析
- **当** 调用 sensitivityEngine.analyze(model, paramValues)
- **那么** 返回每个变量扰动后的排名变化和 flip_count

#### 场景:排名稳定性评级
- **当** flip_count 为 0
- **那么** 稳定性标记为 'stable'
- **当** flip_count 为 1-2
- **那么** 稳定性标记为 'partially_stable'
- **当** flip_count >= 3
- **那么** 稳定性标记为 'unstable'
