# 设计：LLM 数据清洗器

## 数据流

```
LLM 返回的原始 JSON
        │
        ▼
┌─────────────────────────────────────────────────────┐
│ sanitizeModel(rawData)                               │
│                                                     │
│ Step 1: 结构格式化                                   │
│   ├─ 强制数组/对象类型                               │
│   ├─ 补全缺失的必要字段                               │
│   ├─ trade_offs.dimension ⊆ variables.name          │
│   ├─ paths[].impact.key ⊆ variables.name            │
│   └─ scores.key ⊆ options, weights.key ⊆ variables  │
│                                                     │
│ Step 2: 语义索引（构建 _pathRef）                     │
│   ├─ 解析每个 path 的事件链条                         │
│   │   优先用 path.timeline[].event                    │
│   │   回退用 path.name → 按 "→" 分割                  │
│   ├─ 匹配策略（按优先级降级）                          │
│   │   1. 精确匹配: event === node.name                │
│   │   2. 双向包含: event.includes(name) || name.includes(event) │
│   │   3. 位置回退: path segment index → child index   │
│   ├─ 将 pathId 注入到匹配到的树节点                    │
│   │   构建 node → [pathId1, pathId2, ...] 映射       │
│   └─ 最终写回 treeData 的每个节点                     │
│                                                     │
│ 输出: 结构化 + 索引完整的 model                       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ adaptTree(sanitizedData.treeData, sanitizedData.paths)│
│                                                     │
│ 只做视图转换：                                        │
│   ├─ 生成唯一 id                                     │
│   ├─ 复制 _pathRef → 节点的 pathIds                   │
│   ├─ 计算 probability（从 eventProbMap 或 value）     │
│   └─ 扁平化层级为 D3 需要的层次结构                    │
│                                                     │
│ 不再做的事情：                                        │
│   ✗ matchPath 正则匹配                               │
│   ✗ 事件名清理                                       │
│   ✗ 路径注入逻辑                                     │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
前端组件（DecisionTree, PathDetail, ForkComparison）
  直接读取 node.data._pathRef 或 node.data.pathIds
```

## 关键决策

### 1. 匹配策略不用编辑距离

节点名只有 4-6 字，编辑距离在短文本下误差大。"市场萎缩" 和 "市场扩张" 编辑距离为 1，但语义完全相反。改用：精确 → 包含 → 位置回退。

### 2. `_pathRef` 写在 treeData 上还是 paths 上

写在 treeData 节点上。因为前端需要的是"这个节点关联哪些 paths"，而不是"这个 path 经过哪些节点"。树结构天然适合从节点反向查找。

### 3. 清洗器放在前端而非后端

因为这是数据治理层，不应该依赖 LLM 的稳定性。即使 LLM 修复了 prompt，也不能保证每次返回都完美。前端入口统一处理更安全。

### 4. 位置回退必须打印 warn

```js
console.warn(`[Sanitizer] 无法匹配路径事件 "${event}" 到树节点，回退至位置索引 [${childIndex}]`)
```
调试时能一眼看出是 LLM 命名问题还是匹配逻辑问题。

## 语义索引伪代码

```js
function buildPathRefs(treeData, paths) {
  // 1. 构建 optionName → childNodes 的映射
  const optionChildren = {}
  for (const optChild of treeData.children) {
    optionChildren[optChild.name] = flattenNodes(optChild)
  }

  // 2. 对每个 path 构建 _pathRef
  for (const path of paths) {
    const events = extractEvents(path)  // timeline[].event 或 path.name 分割

    // 第一段匹配 option
    const optionName = events[0]
    const matchedOption = treeData.children.find(c => c.name === optionName)
    if (!matchedOption) continue

    // 后续段匹配子节点
    const nodes = optionChildren[matchedOption.name]
    for (let i = 1; i < events.length; i++) {
      const eventName = events[i]
      const matched = matchNode(nodes, eventName, i - 1)
      if (matched) {
        if (!matched._pathRef) matched._pathRef = []
        matched._pathRef.push(path.id)
      }
    }
  }
}

function matchNode(nodeList, eventName, fallbackIndex) {
  // 精确匹配
  const exact = nodeList.find(n => n.name === eventName)
  if (exact) return exact

  // 双向包含
  const partial = nodeList.find(n =>
    n.name.includes(eventName) || eventName.includes(n.name))
  if (partial) return partial

  // 位置回退
  console.warn(`[Sanitizer] 无法匹配 "${eventName}"，回退至索引 [${fallbackIndex}]`)
  return nodeList[fallbackIndex] || null
}
```
