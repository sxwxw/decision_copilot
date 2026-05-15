## 上下文

`correct-modeling-prompts` 变更中定义了 `risk_adjustment` 包含 `offset` 和 `probability_factor` 两个字段。设计文档说 `probability_factor` 应作用于路径概率，但实际实现（simulator.js:196）将其与 `offset` 相乘：`utility += adj.offset * adj.probability_factor`。这导致：
1. 语义错误——`probability_factor` 变成了 offset 的缩放系数而非概率调节器
2. 功能冗余——`offset` 本身已能区分不同风险偏好的评分倾向，`probability_factor` 不提供额外价值
3. 前后端不一致——前端的 `recalcProbabilities` 已有独立的 alignment 概率调节机制

## 目标 / 非目标

**目标：**
- 从 `risk_adjustment` 中移除 `probability_factor` 字段，仅保留 `offset`
- 同步更新所有 prompt 模板、仿真器、前端调用和 mock 数据
- 更新 `correct-modeling-prompts` 的设计文档

**非目标：**
- 不修改 `offset` 的使用方式
- 不修改 `recalcProbabilities` 的概率逻辑
- 不改变权重乘数公式

## 决策

### 决策：仿真器直接加 offset，不再乘以 probability_factor

**当前实现：**
```js
utility += adj.offset * adj.probability_factor
```

**简化后：**
```js
utility += adj.offset
```

**理由：** `offset` 本身就是按风险偏好类型区分后的加分值（如保守型对低风险方案 +5 分），无需再用 `probability_factor` 二次缩放。LLM 在生成模型时已经通过 offset 值的大小体现了偏好差异，额外的乘法因子只会引入不必要的复杂度。

**替代方案（已否决）：** 将 `probability_factor` 真正作用到路径概率上（传入 `recalcProbabilities`）。但这需要给路径标记风险属性以查找对应的 factor，且与现有的 alignment 缩放机制重叠，投入产出比低。

## 风险 / 权衡

- **[风险]** 移除 `probability_factor` 后，`correct-modeling-prompts` 变更的 LLM prompt 中 risk_adjustment 的表达能力减弱。
  **→ 缓解：** offset 本身已足够表达偏好差异（如 +5 vs +10），且 LLM 可以自由决定 offset 值的大小。

- **[风险]** 现有 mock 数据中的 `probability_factor` 字段被移除后，如果有旧数据残留不会造成问题。
  **→ 缓解：** 仿真器只读取 `offset`，忽略未知字段，向后兼容。
