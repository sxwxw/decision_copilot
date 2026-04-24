## 为什么

当前系统的权重计算公式 `base + Σ(paramValue-50) × weight` 对所有方案施加相同的全局偏移量，导致滑块调整后方案排序永远不会改变。这违背了用户对"调参"的核心预期——"我把口味满足拉到最高，烤鸭应该升得更多"。

同时，当前系统存在两套独立分数（`scores` 和 `treeData.value`），用户在不同区域看到不同数值却没有任何解释，造成困惑。

## 变更内容

- 权重计算改为差异化公式：`base + Σ((Wi-0.5) × delta_i × K)`，利用 `logic_payload.trade_offs` 中的 delta 作为各方案对维度的敏感度
- 推荐结论和方案概览展示"双分数"：前端计算分为主分，LLM 基准分为参考分，通过差值指示引导用户理解偏好偏离
- 消除方案概览中 treeData.value 的独立计分，统一走差异化权重公式
- 统一概率语义来源，取消 `value/100` fallback，仅使用 `paths.timeline` 反推的累积概率

## 功能 (Capabilities)

### 新增功能
- `dual-score-display`: 推荐结论和方案概览的双分数展示（主分 + 基准分 + 差值指示）
- `score-attribution`: 分数差异的归因解释（基于 trade_offs 动态生成说明文本）

### 修改功能
- `decision-core`: 权重计算逻辑从全局偏移改为差异化敏感度计算

## 影响

- `src/composables/useDecisionModel.js`: scores computed 公式重构
- `src/components/decision/PathDetail.vue`: 概览卡片改为双分显示
- `src/components/decision/Recommendation.vue`: 推荐卡片改为双分显示
- `src/components/decision/DecisionTree.vue`: 概率 fallback 逻辑调整
- LLM prompt 和数据结构不变，纯前端改造

## 非目标

- 不修改 LLM prompt 或输出格式
- 不新增 sensitivities、local_probability 等字段
- 不废弃 scores 字段，保留其作为基准参考
