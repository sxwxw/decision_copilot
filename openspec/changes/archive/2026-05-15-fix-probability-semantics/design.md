## 上下文

当前 `recalcProbabilities()` 计算调整后概率时不执行归一化。alignment 公式 `1 - |userVal - impactVal| / 100` 中，userVal 是 0~100 的偏好，impactVal 是 LLM 给出的 delta（可为负），两者量纲不同。

## 目标 / 非目标

**目标：**
- 调整后概率归一化，总和 ≈ 1.0
- alignment 公式量纲对齐
- 分数归因动态化

**非目标：**
- 不改变线性评分公式本身
- 不引入蒙特卡洛（那是另一个变更）

## 决策

### 1. 归一化方案

每次 `recalcProbabilities()` 后增加：
```js
const total = rawProbs.reduce((a, b) => a + b, 0)
const normalized = total > 0 ? rawProbs.map(p => p / total) : Array(paths.length).fill(1 / paths.length)
```

### 2. 量纲修复

将 impact delta 映射到 0~100 偏好空间：
```js
const impactMapped = (impactVal + 100) / 2  // [-100,100] → [0,100]
const alignment = 1 - Math.abs(userVal - impactMapped) / 100
```

### 3. 分数归因

从硬编码字符串改为从 `logic_payload.trade_offs` 动态组装。

## 风险 / 权衡

[风险] → 归一化后单个路径概率变化幅度被稀释，用户感知变弱
→ 缓解：归一化是数学正确的必要步骤，概率语义比数值敏感度更重要

[风险] → impact 到偏好空间的线性映射过于简单
→ 缓解：这是比当前"量纲不匹配"更好的方案，后续蒙特卡洛变更会从根本上替代此公式
