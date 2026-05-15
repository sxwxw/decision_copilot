# AI-Decision-Engine → Decision Copilot 改进方案

> 基于对两个项目完整源码的阅读与对比，提炼可落地的改进方向。

---

## 项目对比概览

| 维度 | AI-Decision-Engine | Decision Copilot（当前） |
|---|---|---|
| **前端** | 单 HTML 文件 | Vue 3 + Vite + Element Plus |
| **后端** | Python stdlib `http.server` | Node.js + Express |
| **决策引擎** | 蒙特卡洛仿真器（确定性） | LLM 直接生成决策树 + 线性评分公式 |
| **多 Agent** | 9 步流水线，6 个不同角色 | 单一 LLM 建模 |
| **不确定性建模** | 7 种分布 × 蒙特卡洛 | 路径概率 × trade_offs delta |
| **敏感性分析** | ±20% 扰动自动跑 | 用户手动调滑块看分数变化 |
| **对抗审查** | DEVIL Agent 专门攻击 | 无 |

**Copilot 已有且更强的地方：** 实时参数调节 + 反事实推理 + 分数归因 + 前端工程化。改进方向不是推翻现有架构，而是补足"量化推演"和"质量审查"两个薄弱环节。

---

## 改进一：引入蒙特卡洛仿真引擎

### 现状

`src/composables/useDecisionModel.js:435-468` 的评分公式：

```js
offset = (paramValue / 100 - 0.5) * delta * 2
shift = shift.add(offset)
adjusted[option] = Math.max(0, Math.min(100, base + shift))
```

这是纯线性加权——参数从 50 调到 80，分数变化严格成正比。但现实决策中的变量通常是非线性的（收入服从对数正态、成功率服从 Beta 分布、二值事件服从伯努利分布）。

### AI-Decision-Engine 的做法

[simulator.py](e:\codeLife\AI-decision-engine-zh\simulator.py) 定义了一个 `sim_spec` 契约：

```python
DISTRIBUTIONS = {
    "normal":      ["mean", "sd"],
    "lognormal":   ["mean", "sd"],      # 高度偏斜的正量（收入、成本）
    "triangular":  ["min", "mode", "max"],  # 有最佳估计+上下界
    "beta":        ["alpha", "beta", "min", "max"],  # 概率/比率
    "uniform":     ["min", "max"],
    "bernoulli":   ["p"],               # 二值事件
    "categorical": ["choices"],          # 离散多结果
}
```

然后用 stdlib `random` 跑 N 次（默认 10,000）蒙特卡洛抽样，归一化到 [0, 100]，加权效用，排名。

**关键约束：LLM 只选分布和填参数，不计算结果。仿真器执行所有数值计算。**

### 具体改进方案

**方案 A：移植仿真器到 TypeScript**

在 `src/utils/` 下新增 `simulator.ts`，把 [simulator.py](e:\codeLife\AI-decision-engine-zh\simulator.py) 的逻辑翻译为 TypeScript：

- 7 种分布用 `Math.random()` + Box-Muller / 反函数抽样实现
- 保留 validate → sample → normalize → aggregate → sensitivity 的管线
- 输入契约 `SimSpec` 用 TypeScript interface 定义，LLM prompt 输出 JSON 严格匹配
- Web Worker 运行避免阻塞主线程（仿真 >5000 次时 UI 不卡顿）

**方案 B：保留现有公式，作为仿真器的"快速模式"**

- 用户拖滑块时仍然用线性公式实时反馈（300ms debounce 不变）
- 点"深度模拟"按钮时跑蒙特卡洛，返回 P10/P50/P90 区间 + 排名稳定性
- 两套公式共存，场景不同

**优先级：方案 B 更平滑，不需要推翻现有交互。**

### 新增输出字段

仿真结果可在 [PathDetail.vue](src/components/decision/PathDetail.vue) 中展示：

```
方案A:  效用均值 72.3  [P10=58.1  P50=73.0  P90=84.7]  σ=8.2
方案B:  效用均值 68.1  [P10=52.4  P50=68.8  P90=81.2]  σ=9.1
```

### 注意事项：双模式排名冲突

快速模式（线性）和深度模式（蒙特卡洛）可能给出不同排名。需要在 UI 层面明确区分：

- 快速模式结果标注为"线性近似"
- 蒙特卡洛结果标注为"概率推演"
- 当蒙特卡洛结果可用时，优先展示后者，或并列对比展示

---

## 改进二：多 Agent 流水线替代单一 LLM 建模

### 现状

当前只有一个 `server/prompts/decisionModel.js`——LLM 一次性生成整棵决策树。如果 LLM 在某个环节（比如权重分配、路径概率估计）出错，整个模型就会偏斜。

### AI-Decision-Engine 的做法

9 步流水线，每个 Agent 各司其职：

```
FRAMEWORK → ORACLE‖ECHO → MODEL-PARAMS → SIMULATE → MODEL-INTERPRET → DEVIL‖SAGE → NEXUS → MIRROR
```

| Agent | 职责 | 输出 |
|---|---|---|
| **FRAMEWORK** | 生成评估维度、场景、outcome tracks | JSON 框架 |
| **ORACLE** | 事实研究，给每个选项在各维度上打分 | JSON 评分+置信度 |
| **ECHO** | 社区舆情，真实用户反馈 | JSON 情感分析 |
| **MODEL-PARAMS** | 把框架+研究翻译成仿真器参数 | `sim_spec` JSON |
| **SIMULATE** | 蒙特卡洛（Python，非 LLM） | 统计结果 |
| **MODEL-INTERPRET** | 解读真实仿真数字 | JSON 解读 |
| **DEVIL** | 对抗性批评，找漏洞 | JSON 挑战列表 |
| **SAGE** | 未来趋势预测 | JSON 前瞻模块 |
| **NEXUS** | 综合所有信息写最终报告 | Markdown 报告 |
| **MIRROR** | 元审查，评估整体分析质量 | JSON 质量评分 |

### 具体改进方案

不需要 1:1 复制 9 步（Copilot 的场景更偏向产品/业务决策，不像个人决策需要社区舆情）。建议裁剪为 **5 步**：

```
FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS
```

| Agent | 对应现有代码位置 | 新增内容 |
|---|---|---|
| **FRAMEWORK** | 新增 | 先跑一步，只生成维度、变量、场景框架 |
| **MODEL-BUILD** | 替代现有 `decisionModel.js` | 读 FRAMEWORK，生成决策树 + trade_offs + 分布参数 |
| **SIMULATE** | 新增（复用改进一的仿真器） | 蒙特卡洛 |
| **DEVIL** | 新增 | 对抗审查，输出挑战列表 |
| **NEXUS** | 新增（或整合到 ReportTemplate.vue） | 综合仿真+DEVIL 输出最终报告 |

**关键设计决策：**

- 如果用户只是快速拖滑块看分数变化，只跑 MODEL-BUILD（不触发完整流水线）
- 点"深度模拟"时才触发完整 5 步流水线
- 每步结果缓存到 `pipelineState`，失败可断点续跑（参考 AI-Decision-Engine 的 `pipelineState` 模式）

### 新增后端路由

在 `server/routes/decision.js` 中新增：

```
POST /api/decision/framework    → FRAMEWORK Agent
POST /api/decision/build-model   → MODEL-BUILD Agent（替代现有 /model）
POST /api/decision/devil         → DEVIL Agent
POST /api/decision/nexus         → NEXUS Agent
POST /api/decision/full-pipeline → 一键跑完 5 步（SSE 流式推送进度）
```

### 注意事项：首次建模延迟

拆分 FRAMEWORK + MODEL-BUILD 后，首次建模从 1 次 LLM 调用变成 2 次。需要评估是否可接受。如果用户反馈"秒出"体验下降，可以考虑将 FRAMEWORK 和 MODEL-BUILD 合并为一个 prompt 但在内部保持两步逻辑。

---

## 改进三：引入对抗性审查（DEVIL Agent）

### 现状

Copilot 没有任何机制质疑 LLM 自己生成的模型。如果 LLM 给某个选项打了虚高的初始分，或漏掉了关键变量，用户只能依赖自己发现。

### AI-Decision-Engine 的做法

`prompts.js:293-333` 的 DEVIL Agent prompt 核心指令：

> Attack the analysis to make it stronger. Challenge the #1 option, defend the last-ranked, find data inconsistencies, flag biases.

具体输出结构：

```json
{
  "challenges": [
    {"id": "DEVIL-001", "severity": "critical|moderate|minor",
     "target": "agent/assumption/prior", "title": "...",
     "issue": "...", "evidence": "...", "impact": "...", "recommendation": "..."}
  ],
  "winner_vulnerability": {"option": "#1", "most_likely_disappointment": "...", ...},
  "loser_defense": {"option": "last", "undervalued_aspects": [...], ...},
  "bias_flags": [{"type": "survivorship|anchoring|hallucination|...", "description": "...", "severity": "..."}],
  "single_biggest_assumption": "结论最依赖的那个假设"
}
```

### 具体改进方案

在 Copilot 中新增一个独立的"审查"面板，作为底部面板的第三个 tab（与 PathDetail 和 Sensitivity 并列）：

```
┌──────────────┬──────────────────────┐
│  InputPanel  │    DecisionTree       │
├──────────────┤                      │
│  ParamPanel  │                      │
├──────────────┴──────────────────────┤
│ [路径详情]  [敏感性分析]  [审查]     │  ← 三个 tab 并列
└─────────────────────────────────────┘
```

**展示内容**：

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ 发现 3 项挑战                                         │
├─────────────────────────────────────────────────────────┤
│ DEVIL-001  [严重]  针对：模型假设                         │
│ 标题：收入预期的 trade_off 分布过于乐观                    │
│ 问题：方案A 的收入分布均值设为 80，但 ORACLE 数据显示该行业  │
│      中位数收入仅为 55                                     │
│ 影响：如果修正，方案A 的排名可能从第1降至第3                  │
│ 建议：重新校准收入分布的 mean 参数至 55-60 区间             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🏆 冠军最脆弱假设                                         │
│ 方案A 最依赖：行业增长率 > 15%/年                          │
│ 若不成立：期望效用下降 12.3 分                              │
└─────────────────────────────────────────────────────────┘
```

**触发时机**：

- "深度模拟"完成后自动运行 DEVIL
- 用户点"重新审查"可手动触发
- 如果 `sanitizeModel` 检测到 LLM 返回的数据有明显不一致（已有逻辑，[useDecisionModel.js:38-56](e:\codeLife\decision_copilot\src\composables\useDecisionModel.js#L38-L56)），直接生成 DEVIL 挑战

**偏置类型扩展**：

AI-Decision-Engine 定义了 5 种偏置类型，Copilot 可新增业务决策相关类型：

| 类型 | 说明 |
|---|---|
| `survivorship` | 只看成功案例，忽略失败样本 |
| `anchoring` | 被用户输入中的某个数字锚定 |
| `hallucination` | 编造不存在的事实 |
| `prior_misspecification` | 分布参数偏离现实 |
| `optimism_bias` | 对热门选项过度乐观（新增） |
| `recency_bias` | 过度关注近期信息（新增） |
| `scope_neglect` | 忽略规模差异的影响（新增） |

---

## 改进四：敏感性分析自动化 + 稳定性指标

### 现状

Copilot 的敏感性依赖**用户手动拖滑块**（[DecisionView.vue:67-73](e:\codeLife\decision_copilot\src\views\DecisionView.vue#L67-L73)）：

```js
function onUpdateParam(name, value) {
  state.paramValues[name] = value
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => recalcScores(), 300)
}
```

用户能看变化，但不知道"我的排名稳不稳"。

### AI-Decision-Engine 的做法

[simulator.py:331-374](e:\codeLife\AI-decision-engine-zh\simulator.py#L331-L374) 自动做 ±20% 扰动：

```python
# 每个 outcome weight ±20%
for o in spec["outcomes"]:
    for delta in (-SENSITIVITY_DELTA, SENSITIVITY_DELTA):
        ow = {o["id"]: o["weight"] * (1 + delta)}
        res, _, _ = _run(spec, weight_overrides=ow, seed=base_seed + 101)
        r = _rank(res)
        sens.append({
            "type": "weight", "target": o["id"],
            "delta_pct": int(delta * 100),
            "new_top": r[0], "rank_changed": r[0] != base_rank[0],
        })

# 每个 scenario probability ±20%（同理）
```

然后计算三个稳定性指标：

```python
flips = sum(1 for s in sens if s["rank_changed"])
if flips == 0: stability = "stable"
elif flips <= max(1, len(sens) // 4): stability = "partially_stable"
else: stability = "unstable"

gap_pct = (u1 - u2) / u1 * 100  # 第1 vs 第2 的效用差距
```

### 具体改进方案

在现有 `recalcScores()` 基础上，新增 `runSensitivity()` 方法：

```ts
function runSensitivity() {
  // 对每个变量，分别做 -20% 和 +20% 扰动
  // 记录每次扰动后的排名变化
  // 返回 sensitivity 数组 + stability 指标
}
```

**前端展示**：在 [DecisionView.vue](src/views/DecisionView.vue) 底部面板的"敏感性分析" tab 中展示：

```
┌──────────────────────────────────────────────────────┐
│  敏感性分析                                           │
│                                                      │
│  排名稳定性：■■■□□  部分稳定（2/8 次扰动改变了第一名）   │
│  第1 vs 第2 差距：4.2%                                │
│                                                      │
│  最容易翻转排名的变量：                                │
│  • 技术风险 +20%  → 方案B 成为第一                      │
│  • ROI -20%       → 方案C 成为第一                      │
│                                                      │
│  对其他变量都不敏感的变量：                             │
│  • 用户增长 ±20%  → 排名不变                            │
└──────────────────────────────────────────────────────┘
```

可以用已有的 echarts 绘制蜘蛛图/雷达图展示各变量的敏感度。

**触发时机**：

- 点击"深度模拟"后自动运行
- 敏感性计算在 Web Worker 中进行（避免阻塞 UI）
- 结果存入 `state.sensitivity`，在 PathDetail 中引用

### 前置依赖：概率语义正确

敏感性分析的前提是基础概率合法（路径概率 sum ≈ 1.0）。如果改进七（概率规范化）未先完成，敏感性分析的结果可能不可靠。

---

## 改进五：LLM 与仿真器之间的结构化契约

### 现状

Copilot 的 `sanitizeModel`（[useDecisionModel.js:8-189](e:\codeLife\decision_copilot\src\composables\useDecisionModel.js#L8-L189)）做了大量数据清洗工作——过滤非法变量名、补全缺失分数、推导缺失 trade_offs。这说明 LLM 经常返回不符合预期的结构。

### AI-Decision-Engine 的做法

两层防护：

1. **前端**：`prompts.js` 中的 prompt 用 JSON schema 模板严格约束输出格式
2. **后端**：[simulator.py:43-137](e:\codeLife\AI-decision-engine-zh\simulator.py#L43-L137) 的 `validate()` 函数做 100+ 行校验，返回结构化错误列表

校验失败返回 HTTP 400 + 结构化 `errors[]`，而不是静默修正。

### 具体改进方案

在现有 `sanitizeModel` 之前加一层 `validateModel`：

```ts
interface ModelValidationError {
  field: string    // "weights.风险偏好" | "paths[2].timeline[1].probability"
  message: string  // "probability 必须在 [0, 1] 范围内"
  severity: "error" | "warning"
}

function validateModel(raw: unknown): ModelValidationError[]
```

**校验规则**（部分）：

| 规则 | 错误信息 |
|---|---|
| options 至少 2 个 | "至少需要 2 个选项" |
| weights 值必须在 [0, 1] | "权重 xxx 超出 [0, 1] 范围" |
| scores 必须在 [0, 100] | "分数 xxx 超出 [0, 100] 范围" |
| 路径概率累积 ≠ 1.0 | "路径概率总和为 0.xx，应 ≈ 1.0" |
| trade_offs.dimension ∉ variables | "维度 xxx 不在变量列表中" |
| timeline.event 无对应树节点 | "事件 xxx 在决策树中找不到对应节点" |

**错误处理策略**：

- `error` 级别：拒绝，返回 HTTP 400 + `errors[]`，提示用户重新提交
- `warning` 级别：允许通过，但保留现有 `sanitizeModel` 做自动修正，同时在 UI 中标注（类似 DEVIL 的展示方式）

**扩展覆盖范围**：除了 LLM 输出层，还应覆盖：

- **输入层校验**：修复当前 `/validate` 的 fail-open 问题（LLM 不可用时返回 `{ valid: true }`）
- **概率分布校验**：调整后概率总和偏离 1.0 时发出 warning
- **反事实场景校验**：counterfactual 中的变量名是否存在于当前模型

---

## 改进六：SSE 流式进度推送

### 现状

用户点"深度模拟"后，需要等 `refineModel()` 完整返回才能看到变化。如果 LLM 响应慢（>10 秒），只有 loading spinner。

### AI-Decision-Engine 的做法

前端 `index.html` 的 `runPipeline()` 函数有流水线仪表盘——每完成一步就更新对应阶段的 UI 状态（pending → running → done → error）。

### 具体改进方案

在 `server/routes/decision.js` 的 `/full-pipeline` 路由中使用 SSE：

```js
app.post('/api/decision/full-pipeline', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.write(`data: ${JSON.stringify({step: 'framework', status: 'running'})}\n\n`)
  const framework = await callFramework(req.body.userInput)
  res.write(`data: ${JSON.stringify({step: 'framework', status: 'done', data: framework})}\n\n`)
  // ... 后续每步同理
})
```

前端用 `EventSource` 接收，在 [DecisionView.vue](src/views/DecisionView.vue) 中展示进度条：

```
FRAMEWORK ██████████ 完成
MODEL-BUILD ████░░░░░░ 运行中...
SIMULATE    ░░░░░░░░░░ 等待
DEVIL       ░░░░░░░░░░ 等待
NEXUS       ░░░░░░░░░░ 等待
```

### Vercel Serverless 兼容性

SSE 在 Vercel Serverless 上支持有限（`maxDuration: 60`，且某些平台不保持连接）。需要测试。如果不可行，降级方案是用轮询（polling）：后端每步完成后将状态写入内存/缓存，前端定时查询。

---

## 改进七：概率语义规范化修复（新增）

### 现状

`recalcProbabilities()` 中的对齐缩放公式：

```js
alignment = 1 - |userVal - impactVal| / 100
scale = 0.7 + avgAlignment * 0.6   // 映射到 [0.7, 1.3]
adjustedProbability = cumulative * scale
```

调整后所有路径概率之和不再等于 1.0，破坏了概率分布的语义。用户在报告中看到的概率数值是误导性的。

### 具体问题

1. **概率不归一化**：两条原本 sum = 1.0 的路径，调整后可能变成 0.85 + 1.15 = 2.0
2. **量纲不匹配**：`impact` 值是 delta（可为负），`userVal` 是 0~100 偏好，两者直接比较产生的 alignment 没有实际意义
3. **分数归因文本脆弱**：`getScoreAttribution()` 硬编码了中文字符串，假设特定的 4 路逻辑分支

### 具体改进方案

### 步骤 1：归一化

每次 `recalcProbabilities()` 后增加归一化步骤：

```js
// 调整后的原始概率
const rawProbs = paths.map(p => adjustedProbability(p))
// 归一化
const total = rawProbs.reduce((a, b) => a + b, 0)
const normalizedProbs = rawProbs.map(p => total > 0 ? p / total : 1 / paths.length)
```

### 步骤 2：修复量纲问题

将 alignment 公式中的 `impactVal` 转换为与 `userVal` 同量纲：

```js
// impact 是 delta（-100~100），映射到 0~100 偏好空间
const impactMapped = (impactVal + 100) / 2  // [-100,100] → [0,100]
const alignment = 1 - |userVal - impactMapped| / 100
```

或者更简单的方案：放弃当前的 alignment 缩放，改为直接用 impact 的绝对值作为权重因子。

### 步骤 3：分数归因可配置化

将 `getScoreAttribution()` 的硬编码字符串改为从 `logic_payload` 动态组装，或使用 i18n 键值对。

---

## 改进八：API 安全加固（新增）

### 现状

- 无任何认证机制
- 无频率限制
- 无配额管理
- `/validate` 在 LLM 不可用时 fail-open
- `.env` 文件在 `.gitignore` 中但 API key 可通过环境变量泄露

### 具体改进方案

### 输入校验 fail-open 修复

```js
// server/routes/decision.js - /validate 路由
// 当前：LLM 失败时返回 { valid: true }
// 改为：LLM 失败时返回 { valid: true, fallback: true, message: "验证服务不可用，已放行" }
// 同时在日志中记录，便于后续排查
```

### 基础频率限制

在 Express 中间件层添加简单的 IP 级限流：

```js
// server/middleware/rateLimit.js
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分钟
  max: 20,                    // 最多 20 次 LLM 调用
  message: { error: '请求过于频繁，请稍后再试' }
})

app.use('/api/decision/', apiLimiter)
```

### （c）API Key 保护

- 确认 `.env` 不在版本控制中
- 考虑添加一个应用级 API key（`APP_API_KEY`），前端请求时携带
- 在 Vercel 部署时通过环境变量注入，不写在代码中

### （d）健康检查增强

```js
// GET /api/health 增加 LLM 服务状态
{
  status: "ok" | "degraded",
  llm: "available" | "unavailable",
  uptime: "...",
  version: "..."
}
```

---

## 改进九：基础设施清理（新增）

### 现状

- `echarts` + `vue-echarts` 被引入但从未使用，占 ~800KB 包体积
- 硬编码反事实场景中的变量名（`'收入预期'`、`'成长空间'`）与实际模型不匹配，功能静默失效
- 用户刷新页面后所有决策模型丢失
- `Decimal.js` 中间计算用高精度，最终 `Math.round()` 取整，精度意图落空

### 具体改进方案

| 项目 | 操作 | 优先级 |
| --- | --- | --- |
| 移除 echarts 依赖 | `npm uninstall echarts vue-echarts`，或开始使用它画敏感性蜘蛛图 | 低/取决于改进四 |
| 修复 counterfactual | 改为从 `state.model.variables` 动态生成场景，而非硬编码变量名 | 中 |
| Decimal 精度 | 保留 1 位小数展示，或全程移除 Decimal（因为最终取整） | 低 |
| 用户数据持久化 | 至少做 `localStorage` 级别的本地保存/恢复，后续可接数据库 | 中 |

**counterfactual 动态化示例：**

```js
// 当前：硬编码
const scenario = { '收入预期': 80, '成长空间': 60 }

// 改为：从模型变量动态采样
function generateCounterfactual(model, direction) {
  const values = {}
  for (const v of model.variables) {
    if (direction === 'optimistic') values[v.name] = 80
    else if (direction === 'pessimistic') values[v.name] = 20
    else values[v.name] = 50
  }
  return values
}
```

---

## 实施优先级建议

| 优先级 | 改进项 | 工作量 | 价值 | 依赖 |
| --- | --- | --- | --- | --- |
| **P0** | 改进五：结构化校验 | 1-2 天 | 高：减少 LLM 幻觉导致的数据错误 | 无 |
| **P0** | 改进七（部分）：概率归一化 + 量纲修复 | 0.5-1 天 | 高：保证概率语义正确 | 无 |
| **P0** | 改进八（部分）：输入校验 fail-open + 基础限流 | 0.5 天 | 高：防止 API 滥用 | 无 |
| **P1** | 改进一（方案 B）：蒙特卡洛作为深度模式 | 3-5 天 | 高：非线性不确定性建模 | P0 概率归一化 |
| **P1** | 改进三：DEVIL 对抗审查 | 2-3 天 | 中高：增加推荐可信度 | P0 校验完成 |
| **P1** | 改进四：敏感性自动化 | 2-3 天 | 中高：告诉用户排名稳不稳 | P0 概率归一化 + 改进一 |
| **P1** | 改进九（部分）：counterfactual 动态化 | 0.5-1 天 | 中：修复静默失效功能 | 无 |
| **P2** | 改进二：多 Agent 流水线 | 5-7 天 | 中：提升建模质量 | P0 + P1 完成 |
| **P2** | 改进六：SSE 流式推送 | 1-2 天 | 中：改善用户体验 | 改进二完成 |
| **P2** | 改进九（部分）：用户数据持久化（localStorage） | 1-2 天 | 中：修复刷新丢失问题 | 无 |
| **P3** | 改进九（部分）：Decimal 精度/echarts 清理 | 0.5 天 | 低：代码卫生 | 改进四决定 |

**推荐分阶段实施：**

- **第 1 阶段（1 周）**：P0 — 校验 + 概率归一化 + 基础安全加固。这三个改动最小，立竿见影，且是后续所有分析的基础
- **第 2 阶段（1-2 周）**：P1 — 蒙特卡洛仿真器 + DEVIL + 敏感性 + counterfactual 修复。给模型加上"量化推演"和"质量标签"
- **第 3 阶段（1-2 周）**：P2 — 多 Agent 拆分 + SSE + 数据持久化。这是最大的架构变化，但前两步做完后用户已经能体验到改进
- **第 4 阶段（0.5 周）**：P3 — 代码卫生清理

---

## 架构演进图

```
当前架构：
┌──────────┐     ┌──────────┐     ┌─────────────┐
│ 输入问题  │────▶│ 单一 LLM  │────▶│ 决策树 + 线性│
│          │     │ 建模      │     │ 评分公式     │
└──────────┘     └──────────┘     └──────┬──────┘
                                         │
                                  用户手动调滑块
                                         │
                                  ┌──────▼──────┐
                                  │ 实时线性重算 │
                                  └─────────────┘


目标架构：
┌──────────┐     ┌────────────┐     ┌──────────────┐
│ 输入问题  │────▶│ FRAMEWORK  │────▶│ MODEL-BUILD  │
│          │     │ (维度/场景) │     │ (决策树+分布) │
└──────────┘     └────────────┘     └──────┬───────┘
                                           │
                                   ┌───────▼────────┐
                                   │ 蒙特卡洛仿真    │  ← 确定性引擎
                                   │ (非线性推演)    │
                                   └───────┬────────┘
                                  ┌────────▼──────────┐
                                  │ 敏感性分析(自动)   │
                                  └────────┬──────────┘
                                 ┌─────────▼─────────┐
                                 │ DEVIL 对抗审查     │
                                 └─────────┬─────────┘
                                 ┌─────────▼─────────┐
                                 │ NEXUS 综合报告     │
                                 └───────────────────┘

贯穿始终：
  ┌─────────────────────────────────────┐
  │ 结构化校验 (改进五)                   │
  │ 概率规范化 (改进七)                   │
  │ API 安全加固 (改进八)                 │
  └─────────────────────────────────────┘
```

---

## 变更拆解

完成以上所有改进，建议拆分为 **7 个独立的 OpenSpec 变更**，按依赖关系排序：

| # | 变更名称 | 包含改进项 | 预计工作量 | 依赖 |
| --- | --- | --- | --- | --- |
| 1 | `add-model-validation` | 改进五：结构化校验层 | 1-2 天 | 无 |
| 2 | `fix-probability-semantics` | 改进七：概率归一化 + 量纲修复 | 0.5-1 天 | 无 |
| 3 | `harden-api-security` | 改进八：限流 + fail-open 修复 + 健康检查 | 0.5 天 | 无 |
| 4 | `add-monte-carlo-simulation` | 改进一：蒙特卡洛仿真器 + 改进九(counterfactual) | 3-5 天 | #2 |
| 5 | `add-devil-review` | 改进三：DEVIL 对抗审查 | 2-3 天 | #1, #4 |
| 6 | `add-sensitivity-analysis` | 改进四：敏感性自动化 | 2-3 天 | #4 |
| 7 | `add-multi-agent-pipeline` | 改进二：多 Agent + 改进六：SSE | 5-7 天 | #1, #5 |

此外还有一个独立变更（无严格依赖，但建议与 #7 同期做）：

| # | 变更名称 | 包含改进项 | 预计工作量 | 依赖 |
| --- | --- | --- | --- | --- |
| 8 | `add-local-persistence` | 改进九：localStorage 持久化 | 1-2 天 | 无 |

### 为什么这样拆分

- **#1-#3 是基础设施**：它们互不依赖，可以并行实施，且是后续所有分析类变更的前提
- **#4 是核心引擎**：蒙特卡洛仿真器是敏感性和 DEVIL 的数据源
- **#5-#6 是分析层**：建立在仿真结果之上，可以并行（因为仿真器提供两种不同的数据）
- **#7 是架构层**：多 Agent 流水线是最大变更，需要前面的基础都就绪
- **#8 是用户体验**：独立于核心功能，随时可做

### 实施顺序

```
Phase 1 (并行):  #1 ───┐
                     #2 ──┤
                     #3 ──┘
                           │
Phase 2:                #4 (依赖 #2)
                           │
                ┌──────────┴──────────┐
Phase 3 (并行): #5 (依赖 #1,#4)      #6 (依赖 #4)
                           │
Phase 4:                #7 (依赖 #1,#5)
                (任意时间) #8 (无依赖)
```
