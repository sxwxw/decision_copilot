## 上下文

PathDetail.vue 在 `refactor-path-detail` 变更后已支持叶节点的路径溯源视图（路径链 + timeline + AI 结论），但所有节点类型仍共用同一渲染逻辑。中间节点（方案节点如"白切鸡"、过程节点如"蘸料提鲜"）是决策分叉路口，用户需要看到"从这里出发有哪些路可以走、各自的代价和收益"。当前 treeData 中间节点缺乏结构化决策元数据，前端也无分叉对比视图组件。

## 目标 / 非目标

**目标：**
- LLM 为 treeData 中间节点生成 `logic_payload` 结构化元数据（key_impact / risk_level / trade_offs / opportunity_cost）
- PathDetail.vue 根据节点类型（根/中间/叶）渲染三种不同视图
- 新增 ForkComparison.vue 组件：中间节点分叉对比视图，并排展示各子分支
- 前端基于 logic_payload 模板拼接决策建议文本

**非目标：**
- 不修改 DecisionTree.vue 的画图逻辑
- 不改变 paths 数据结构
- 不引入额外 LLM 接口调用（深度报告除外，留作后续扩展）
- 不修改 Recommendation 组件

## 决策

### 1. logic_payload 由 LLM 一次性生成（非前端反查）

treeData 中间节点的 `logic_payload` 由 LLM 在建模时生成，而非前端从 paths[].timeline 反查。理由：LLM 理解决策分叉的语义上下文（为什么在这里分叉、权衡了什么），而 timeline 只记录已发生事实。前端反查无法获取"机会成本"和"决策权衡点"这类抽象信息。

`logic_payload` 结构：
```js
{
  key_impact: string,        // 核心影响维度，如"健康收益"
  risk_level: string,        // 风险等级："低"/"中"/"高"
  primary_reason: string,    // 主要理由，一句话解释
  trade_offs: [              // 决策权衡维度
    { dimension: string, delta: number }  // delta 正负表示增减
  ],
  opportunity_cost: string   // 机会成本描述
}
```

### 2. 三种视图模式：通过节点 step + children 判断

```
根节点 (step === 0, 无父节点):
  → 全局概览：遍历 treeData.children（所有方案），渲染方案卡片列表

中间节点 (step >= 1, 有 children):
  → 分叉对比：ForkComparison.vue
    左侧面包屑 + 右侧并排对比卡片

叶节点 (无 children):
  → 路径溯源：PathDetail 已有逻辑
```

视图切换由 PathDetail.vue 内部计算属性决定，DecisionView.vue 不感知。

### 3. 对比视图采用并排卡片，不用 Tabs

Tabs 隐藏信息，用户需要来回切换才能对比。并排卡片（Side-by-Side）让用户一眼看到差异。对比维度：
- 分支名称 + 概率
- 加权分值（从子树 score 计算）
- 核心代价（来自 logic_payload.opportunity_cost）
- trade_offs 维度对比

当分支超过 2 个时，采用横向滚动 + 卡片等宽布局。

### 4. 决策建议：前端模板拼接（非 LLM 实时生成）

LLM 仅提供结构化元数据（logic_payload），前端根据模板动态拼接：

```
"系统检测到您已进入 [节点名称]。此阶段的 [key_impact] 潜力最大。
 基于您当前的偏好（[最高权重参数]），后续建议优先关注 [高概率子分支]
 以锁定最高收益。选择该分支的机会成本：[opportunity_cost]。"
```

仅在用户点击"查看深度分析"时才调用额外 LLM 接口（本次不实现）。

### 5. 数据流转：adaptTree 透传 logic_payload

`adaptTree()` 只需在标准化节点时原样透传 `logic_payload` 字段，不做额外计算。保持适配器轻量，逻辑集中在视图层。

## 风险 / 权衡

- [风险] LLM 生成的 logic_payload 格式不一致 → 在 prompt 中严格定义字段结构和示例，前端做 fallback 处理（缺失字段显示默认文案）
- [风险] 对比视图在窄屏下卡片拥挤 → 分支超过 2 个时启用横向滚动，每个卡片设置 min-width
- [权衡] 前端模板拼接 vs LLM 实时生成 → 模板方案节省 Token 和响应时间，但灵活性有限。后续可通过"深度分析"按钮按需调用 LLM 弥补
