## 上下文

当前权重计算使用全局偏移公式 `base + Σ(paramValue-50) × weight`，totalShift 对所有方案相同，导致滑块调整后排序不变。同时 `scores`（LLM 基准分）和 `treeData.value`（节点分值）两套分数共存但无解释，用户困惑。

## 目标 / 非目标

**目标：**
- 权重计算实现差异化敏感度，使排序能随用户偏好变化而重排
- 建立双分显示策略，让 LLM 基准分和计算分的关系透明化
- 纯前端改造，不改 LLM prompt 和数据结构

**非目标：**
- 不引入 sensitivities、local_probability 等新字段
- 不废弃 scores 字段
- 不修改后端 API 或 prompt

## 决策

### 1. 敏感度数据来源：复用 trade_offs.delta

**选 X 的原因：** LLM 已在 `logic_payload.trade_offs` 中生成了方案对每个维度的响应系数（delta），这正是敏感度 Si 的定义。新增 sensitivities 字段会浪费 token 且增加 LLM 出错率。

**替代方案：** 让 LLM 额外输出 sensitivities 对象 → 否决，数据重复且增加 prompt 复杂度。

### 2. 分数计算公式

```
adjusted[方案] = clamp(
  baseScore[方案] + Σ((Wi - 0.5) × sensitivity[方案][维度i] × K),
  0, 100
)
```

其中：
- `Wi` = 用户滑块值 / 100（归一化到 0-1）
- `sensitivity` 从 trade_offs 中提取：`delta` 值除以 K 得到标准化敏感度
- `K = 100` 为放大系数，确保 delta 值直接映射到分数偏移

**简化后：**
```
adjusted[方案] = clamp(
  baseScore[方案] + Σ((paramValue[维度] - 50) / 100 × delta[方案][维度] × 100),
  0, 100
)
= clamp(
  baseScore[方案] + Σ((paramValue[维度] - 50) × delta[方案][维度] / 100 × 100),
  0, 100
)
= clamp(
  baseScore[方案] + Σ((paramValue[维度] - 50) × delta[方案][维度] / 100 × 100),
  0, 100
)
```

**实际上简化为：**
```
adjusted[方案] = clamp(
  baseScore[方案] + Σ((paramValue[维度] - 50) × delta[方案][维度] / 100),
  0, 100
)
```

不对，重新整理。放大系数 K 的目的是让 trade_offs 的 delta 直接贡献到分数：

```
adjusted[方案] = clamp(
  baseScore[方案] + Σ((paramValue[维度] / 100 - 0.5) × delta[维度] × 2),
  0, 100
)
```

当 paramValue=100（最重视）时：`(1 - 0.5) × delta × 2 = delta`
当 paramValue=50（中性）时：`(0.5 - 0.5) × delta × 2 = 0`
当 paramValue=0（最不重视）时：`(0 - 0.5) × delta × 2 = -delta`

**所以最终公式：**
```
shift[维度] = (paramValue[维度] / 100 - 0.5) × delta[维度] × 2
adjusted[方案] = clamp(baseScore[方案] + Σ shift, 0, 100)
```

### 3. 双分显示设计

- 主分 = adjusted score（计算分），大号字体
- 副分 = LLM scores（基准分），小号灰色
- 差值 = adjusted - base，正数绿色 ↑，负数黄色 ↓

### 4. 归因解释

当 |差值| > 5 时，显示简短归因：
"与基准差异较大，因您在 [最高权重维度] 上赋予极高重视"

## 风险 / 权衡

**[风险]** trade_offs 可能未覆盖所有维度，导致未覆盖维度的用户偏好无法影响分数。
**→ 缓解**：未被 trade_offs 覆盖的维度默认 delta=0（不影响分数），与旧公式行为一致。

**[风险]** K 值过大导致分数溢出或排序极端反转。
**→ 缓解**：clamp(0,100) 保护边界；通过 UI 测试验证 K=2 系数的合理性。
