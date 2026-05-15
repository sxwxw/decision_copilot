## 修改需求

### 需求:Delta 后端校验

`validateModel()` 函数必须校验 trade_offs.delta 的合理性：单个 delta 绝对值超过 20 时标记为 warning，超过 40 时标记为 error。同一维度跨选项 delta 差值超过 30 时标记为 warning。

#### 场景:Delta 在合理范围内
- **当** 某 trade_offs.delta 绝对值 ≤ 20
- **那么** 校验通过，不产生 warning 或 error

#### 场景:Delta 超出合理范围
- **当** 某 trade_offs.delta 绝对值 > 40
- **那么** 校验返回 error 级别错误，模型被拒绝

#### 场景:跨选项 delta 差值过大
- **当** 同一维度在两个选项中的 delta 差值绝对值 > 30
- **那么** 校验返回 warning 级别警告，模型被返回但附带提醒

### 需求:蒙特卡洛仿真公式更新

`runMonteCarlo` 函数中的效用计算必须将权重作为乘数。对于每个 trade_off 条目，偏移公式必须为 `offset = (sampled[dim]/100 - 0.5) * delta * 2 * weight`。

#### 场景:仿真结果反映权重差异
- **当** 运行蒙特卡洛仿真，某变量权重为 0.3
- **那么** 该变量的偏移贡献是权重为 0.1 变量的 3 倍
