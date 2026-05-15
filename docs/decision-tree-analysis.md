# 决策树深度分析报告

> 基于对 `server/prompts/decisionModel.js`、`src/composables/useDecisionModel.js`、`src/utils/simulator.js`、`server/routes/decision.js` 的全面审查。

---

## 一、当前结构设计

### 1.1 树的层级结构

```
Root（step=0, value=100, 纯容器）
├── 选项A（step=0, value=基准分）
│   ├── L1 事件节点（step=1, eventType, logic_payload）
│   │   └── L2 后果节点（step=2, isDashed=true）
│   └── L1 事件节点（step=1）
│       └── L2 后果节点（step=2）
└── 选项B（step=0, value=基准分）
    ├── L1 事件节点（step=1）
    │   └── L2 后果节点（step=2）
    └── L1 事件节点（step=1）
        └── L2 后果节点（step=2）
```

每个中间节点（非叶子）携带 `logic_payload`，包含 `trade_offs`、`key_impact`、`risk_level`、`opportunity_cost`。

### 1.2 树处理流程

```
LLM 返回 rawTree
  → adaptTree() 标准化：
      1. 从 paths 计算 eventProbMap（事件名 → 累积概率）
      2. 递归遍历节点，赋 id / step / score / probability / isDashed
      3. 清理节点名（去除"第X年:"前缀）
      4. 从 _pathRef 映射 pathIds
  → state.model.treeData
```

关键代码：[useDecisionModel.js:418-488](src/composables/useDecisionModel.js#L418-L488)

---

## 二、当前概率计算逻辑

系统中有**三套独立的概率/效用计算机制**：

### 2.1 静态路径概率（adaptTree）

**公式：** `P(path) = P(event1) × P(event2) × ...`

从 `paths[].timeline` 中逐个事件连乘，按事件名匹配回树节点。

**位置：** [useDecisionModel.js:421-436](src/composables/useDecisionModel.js#L421-L436)

**问题：** 无。这是正确的条件概率计算。

### 2.2 动态概率调整（recalcProbabilities）

**触发：** 用户拖动参数滑块时调用。

**公式：**
```
Step 1: cumulative = P(event1) × P(event2)          // 基础累积概率
Step 2: for each event:
          alignment = 1 - |userVal - (50 + impactVal)| / 100
          scale = 0.7 + alignment * 0.6              // [0,1] → [0.7, 1.3]
          cumulative *= scale
Step 3: normalize(all adjustedProbabilities)         // 使总和 ≈ 1.0
```

**位置：** [useDecisionModel.js:680-739](src/composables/useDecisionModel.js#L680-L739)

**问题：** 详见下方问题 #1

### 2.3 蒙特卡洛效用仿真（simulator.js）

**触发：** 用户触发深度仿真时。

**流程：**
```
1. 对每个变量按其 sim_spec 分布抽样 N 次
2. 对每个选项，计算效用：
     utility = base_score + Σ (sampled[dim]/100 - 0.5) * delta * 2
3. 统计 P10/P50/P90/mean/sigma
4. 按 mean 排序得到排名
```

**关键代码：** [simulator.js:130-229](src/utils/simulator.js#L130-L229)

**注：** 本次 `simplify-risk-adjustment` 变更后，效用计算中还会加上 `risk_adjustment[offset]`。

**问题：** 详见下方问题 #2

---

## 三、已识别的问题与隐患

### 问题 #1：recalcProbabilities 对齐公式基准值错误

**严重程度：🔴 高**

**代码：**
```js
alignment = 1 - Math.abs(userVal - (50 + impactVal)) / 100
```

**问题：** `impact` 字段中的值是**绝对值**（如 80），不是 delta。所以基准值 `50 + 80 = 130`，远超 [0, 100] 范围。用户参数 `userVal` 最大只能到 100，因此 `|100 - 130| / 100 = 0.3`，alignment 永远 ≤ 0.7，大多数情况下更低。

**实际效果：** 参数调整对概率的影响被严重削弱，几乎无效。

**注释说：** `impactVal is a delta`  
**事实是：** impact 值是绝对值，不是差值。

---

### 问题 #2：概率 ≠ 偏好匹配度（概念混淆）

**严重程度：🟡 中**

`recalcProbabilities` 用用户偏好与事件 impact 的匹配度来缩放路径概率。但这是一个概念混淆：

- **路径的客观概率**：这件事在现实中有多大概率发生（如"晋升概率 45%"）
- **用户的主观偏好**：用户希望这个结果发生

用户偏好与事件 impact 高度匹配 → 说明"这条路符合用户利益"，但这**不意味着**"这条路更可能发生"。将主观偏好混入客观概率，会让概率值失去其真实含义。

**建议：** 偏好匹配度应该影响**效用/分数**（这已经是 simulator 在做的事），而不是影响**概率**。

---

### 问题 #3：三套概率机制互不联动

**严重程度：🟡 中**

| 机制 | 计算什么 | 是否受用户偏好影响 | 用途 |
|------|---------|-------------------|------|
| 静态路径概率 | P(事件链发生) | 否 | 树上节点显示 |
| 动态调整后概率 | 偏好缩放后的概率 | 是 | UI 展示 |
| 蒙特卡洛分布 | 效用值分布 | 是（通过 risk_adjustment） | 排名 + 置信度 |

三者各算各的，没有统一模型。蒙特卡洛排名和路径概率排名可能不一致，但系统没有处理这种不一致。

---

### 问题 #4：Root 节点冗余 + step 语义混乱

**严重程度：🟢 低（影响可控）**

- Root 节点的 `value=100` 没有决策含义，只是容器
- Root 和 Option 的 `step` 都是 0，但它们不是同一逻辑层级
- `adaptTree` 中 `adaptNode(rawTree, 0, null)` 的 depth 参数对 Root 和 Option 没有区分

如果未来需要支持超过 3 层决策深度，现有结构需要改造。

---

### 问题 #5：pathIds 依赖 LLM 返回的 `_pathRef` 内部标记

**严重程度：🟢 低**

`adaptTree` 中：
```js
const pathIds = Array.isArray(node._pathRef) ? [...node._pathRef] : []
```

`_pathRef` 是 prompt 中的内部标记（`_pathRef: ["path-1"]`），依赖 LLM 严格遵循 prompt 格式。如果 LLM 忘记返回这个字段，pathIds 就为空，导致路径高亮和节点联动失效。

---

### 问题 #6：delta 范围无硬性约束（已被 correct-modeling-prompts 修复）

**严重程度：✅ 已修复**

之前的 delta 没有范围限制，LLM 可能给出 +50、-60 等极端值。本次 `correct-modeling-prompts` 变更已在 prompt 中限制 ±20，在后端 `validateModel()` 中增加了 ±40 error / ±20 warning 校验。

---

## 四、问题优先级总结

| 优先级 | 问题 | 建议处理方式 |
|--------|------|-------------|
| 🔴 P0 | #1 对齐公式基准值错误 | 修复：确认 impact 是绝对值还是 delta，修正公式 |
| 🟡 P1 | #2 概率/偏好概念混淆 | 讨论：recalcProbabilities 是否应保留 |
| 🟡 P1 | #3 三套机制不联动 | 规划：建立统一概率-效用模型 |
| 🟢 P2 | #4 Root 冗余 + step 语义混乱 | 重构：考虑去除 Root 或重新定义 step |
| 🟢 P2 | #5 pathIds 依赖 _pathRef | 加固：在 adaptTree 中按节点名自动匹配 pathIds |
| ✅ DONE | #6 delta 范围约束 | correct-modeling-prompts 已修复 |

---

## 五、建议的讨论议题

1. **recalcProbabilities 是否应该保留？** 如果"概率反映客观发生可能性"，偏好匹配度不应影响概率。可以考虑将 alignment 缩放改为对**效用值**的调整而非概率。

2. **是否需要统一概率与效用的关系？** 当前路径概率和蒙特卡洛效用是两条独立计算线。是否应该让路径概率影响期望效用（`E[U] = Σ P(path_i) × U(path_i)`）？

3. **树结构是否需要扩展深度？** 当前固定 3 层是否足够覆盖所有决策场景？

4. **是否需要给路径标注风险等级？** 这样 risk_adjustment 可以更精确地按路径风险类型调节效用，而不是只看 Option 级别。
