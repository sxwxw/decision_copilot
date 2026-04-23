# 设计：Decision Copilot 核心功能

## 架构总览

```
前端 (Vue 3, :5173)  ──REST──▶  后端 (Express, :3000)  ──fetch──▶  Qwen API
  │                                │
  ├── 三栏布局                      ├── POST /api/decision/model
  ├── ECharts 决策树                ├── POST /api/decision/deep-path
  ├── 元数据驱动参数面板             └── GET /api/health
  └── Composables 状态
```

## 前端设计

### 页面结构

`DecisionView.vue` — 三栏 Flex 布局，比例 1fr : 1fr : 2fr

### 组件层级

```
DecisionView
├── InputPanel          # 问题描述输入 + 提交按钮
├── ParamPanel          # 元数据驱动动态参数控件
│   ├── ParamSlider     # 权重滑块组件
│   └── ParamSelect     # 变量选择器
└── ResultPanel
    ├── DecisionTree    # ECharts tree 可视化
    ├── PathDetail       # 节点点击联动详情
    └── Recommendation  # 推荐结论卡片
```

### 状态管理

使用 Composables（`useDecisionModel.js`），不引入 Pinia。状态集中在 `DecisionView`，通过 props/emit 传递。

### 计算分工

- **LLM（后端）**: 首次建模、路径生成、定性解释、推荐文本
- **前端**: 用户调参后本地权重加权重算分数，秒级更新树和结论

### 决策树交互

- ECharts tree 图表渲染
- 点击节点高亮从根到该节点的路径（通过 `setOption` 更新 itemStyle）
- 侧边显示该节点的路径详情（概率、指标、解释）

## 后端设计

### 路由

| 方法   | 路径                          | 描述                   |
|--------|-------------------------------|------------------------|
| POST   | /api/decision/model           | 接收问题描述，返回决策模型 |
| POST   | /api/decision/deep-path       | 接收路径上下文，返回展开详情 |
| GET    | /api/health                   | 健康检查               |

### Qwen 调用

`llmService.js` 封装：构造 prompt → fetch Qwen API → 解析 JSON → 容错处理。

Prompt 模板定义在 `prompts/decisionModel.js`，指定 JSON 输出格式。

### Mock 数据

`server/mock/decisionModel.json` — 与真实接口返回结构完全一致，前端开发阶段直接读取。

## 联调策略

1. **阶段1**: 前端读 mock JSON，UI 全部跑通
2. **阶段2**: 启动 Express 后端，Vite proxy 转发，替换 mock
3. **阶段3**: 接入 Qwen API，端到端测试

---

## 设计升级：从"评分工具"到"决策推演系统"

### 升级目标

将决策树从"静态结果分类"升级为"带时间维度的未来路径推演"，使参数变化不仅影响分数，还影响路径概率和结构，增强可解释性和 AI 交互感。

### 数据模型升级

#### treeData 新增时间线字段

每个节点增加 `year`、`eventType`、`probability` 字段，保持向后兼容：

```
根节点
└── 留在大厂 (year:0, 主选项)
    ├── 第1年：绩效达标 (year:1, eventType:positive)
    │   ├── 第2年：晋升成功 (year:2, eventType:positive)
    │   └── 第2年：晋升受阻 (year:2, eventType:negative)
    └── 第1年：组织调整 (year:1, eventType:negative)
        └── 第2年：转岗/离职 (year:2, eventType:neutral)
```

新增字段：

- `year` — 时间节点（0 = 当前决策，1/2/3 = 第N年）
- `eventType` — `positive` / `negative` / `neutral`，用于视觉区分
- `probability` — 到达此节点的概率，随参数联动

#### paths 新增 timeline 字段

每条路径保留原有字段（probability, income, growth, risk, happiness, explanation），新增 `timeline`：

```json
{
  "id": "path-1",
  "name": "留在大厂 → 晋升顺利",
  "probability": 0.6,
  "timeline": [
    { "year": 1, "event": "绩效达标", "probability": 0.70, "impact": { "收入预期": 10, "成长指数": 5 } },
    { "year": 2, "event": "晋升成功", "probability": 0.50, "impact": { "收入预期": 20, "幸福指数": 5 } },
    { "year": 3, "event": "稳定发展", "probability": 0.45, "impact": { "收入预期": 30, "成长指数": 15 } }
  ],
  ...
}
```

### 参数联动概率机制

#### 事件阈值规则

每条路径上的事件增加 `threshold` 条件：

```json
{ "event": "晋升成功", "requires": { "成长空间": 60 }, "baseProb": 0.7 }
{ "event": "公司倒闭", "requires": { "风险指数": 50 }, "baseProb": 0.3 }
```

计算逻辑（`useDecisionModel.js` 中 `recalcProbabilities`）：

1. 用户调参后，遍历所有事件的 `requires` 条件
2. 如果 paramValue >= threshold，概率上浮（`baseProb * 1.2`），否则下调（`baseProb * 0.8`）
3. 对同一父节点下的子节点概率做归一化，保证总和为 1
4. 概率 < 5% 的事件视觉上灰掉

#### 可视化反馈

- 决策树节点旁显示概率百分比
- `eventType` 用颜色区分：`positive` = 绿色, `negative` = 红色, `neutral` = 灰色
- 概率变化时，节点颜色深浅变化（概率越高越饱和）

### PathDetail 升级为"故事时间线"

从 4 个指标卡片改为时间线叙事：

- 垂直时间线，按年份排列事件
- 每个事件显示：名称、概率、触发影响（指标变化）
- 顶部保留总概率和 4 个指标摘要卡片

### 反事实对比

推荐结论区增加对比按钮：

- 预定义场景：「如果更看重成长？」「如果更看重稳定？」
- 点击后自动调整 `paramValues`，触发 `recalcScores`
- 高亮显示分数和概率的变化（diff 对比）

### 组件变更

| 组件 | 变更 |
| --- | --- |
| `DecisionTree.vue` | 节点显示概率值、eventType 颜色；支持 roam（缩放/拖拽） |
| `PathDetail.vue` | 重写为时间线叙事视图，保留顶部指标摘要 |
| `useDecisionModel.js` | 新增 `recalcProbabilities()` 计算函数 |
| `Recommendation.vue` | 新增反事实对比按钮组 |
| `mock/decisionModel.json` | 升级数据模型结构 |
