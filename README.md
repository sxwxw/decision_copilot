# Decision Copilot — AI 决策辅助器

> 不是告诉你该怎么选，而是让你看到每个选择的未来。

## 项目背景

人们在面对跳槽、创业、转行、留学等复杂决策时，常常受困于：

- **信息不完全** — 未来不可预测
- **变量复杂** — 收入、成长、风险、家庭等多维度交织
- **情绪干扰** — 焦虑、恐惧、冲动导致偏差
- **难以推演** — 缺乏"模拟未来结果"的工具

Decision Copilot 是一个基于 LLM 的决策辅助系统，将决策建模为 **选项 + 变量 + 不确定性 + 时间维度**，通过 AI 生成多路径推演，并提供量化评估与可解释分析。

## 核心能力

| 能力 | 说明 |
|------|------|
| 决策建模引擎 | 输入决策问题，AI 自动生成决策树、路径推演与推荐结论 |
| 多路径未来模拟 | 为每个选择生成多个可能未来，附带概率与量化指标 |
| 动态量化评估 | 差异化敏感度公式，调参后秒级重算分数 |
| 深度模拟 | 基于用户调参后的环境，LLM 重新推演并注入 delta 分析 |
| 价值观对齐 | 参数滑块调整权重（风险/收入/成长），分数随偏好实时变化 |
| 可解释分析 | LLM 输出每个路径的解释文本，前端动态生成归因文案 |
| PDF 报告导出 | 商务冷感风格报告，含置信度、归因矩阵、风险压测 |

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vue 3 (`<script setup>`) + Vite + Element Plus |
| 可视化 | D3.js（决策树） + Decimal.js（高精度计算） |
| 后端 | Node.js + Express 5 |
| LLM | 通义千问（DashScope 兼容 API） |
| 报告 | html2canvas + jsPDF |
| 规范 | OpenSpec（spec-driven schema） |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API Key 和模型配置

# 3. 启动后端（端口 3000，自动代理 /api/*）
npm run server:dev

# 4. 启动前端（新终端）
npm run dev

# 5. 浏览器访问 http://localhost:5173
```

## 人机协作流程

```text
1. 用户输入决策问题
   ↓
2. AI 解析并生成决策模型（选项/变量/权重/树结构/路径/评分）
   ↓
3. 前端渲染决策树 + 参数面板（元数据驱动）
   ↓
4. 用户调整参数滑块（价值观对齐）
   ↓
5. 前端本地秒级重算分数，或触发深度模拟（LLM 二次推演）
   ↓
6. 输出建议与可解释分析
```

## 项目结构

```text
├── src/                          # 前端
│   ├── api/decision.js           # 决策 API 客户端
│   ├── components/
│   │   ├── decision/
│   │   │   ├── DecisionTree.vue  # D3 决策树可视化
│   │   │   ├── InputPanel.vue    # 问题输入面板
│   │   │   ├── ParamPanel.vue    # 参数控制（滑块/选择器）
│   │   │   ├── PathDetail.vue    # 路径详情面板（溯源/分叉/概览）
│   │   │   ├── ForkComparison.vue# 分叉对比视图
│   │   │   └── ReportTemplate.vue# PDF 报告模板
│   │   └── common/               # 通用组件
│   ├── composables/
│   │   └── useDecisionModel.js   # 核心状态管理（建模/评分/模拟）
│   ├── utils/                    # 工具类（报告导出等）
│   └── views/
│       └── DecisionView.vue      # 决策主页面
├── server/                       # 后端
│   ├── index.js                  # Express 入口 + Vite 代理
│   ├── routes/decision.js        # 决策路由（建模/模拟/细化）
│   ├── services/llmService.js    # LLM 调用服务
│   ├── prompts/decisionModel.js  # 系统 Prompt 定义
│   └── mock/                     # Mock 数据
├── openspec/                     # OpenSpec 规格
│   ├── specs/                    # 主规格说明
│   └── changes/archive/          # 已归档变更
└── .env                          # 环境变量
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DASHSCOPE_API_KEY` | LLM API Key |
| `DASHSCOPE_API_URL` | API 端点（OpenAI 兼容格式） |
| `DECISION_MODEL` | 快速建模使用的模型 |
| `SIMULATE_MODEL` | 深度模拟使用的模型 |
| `USE_REAL_LLM` | 是否启用真实 LLM（`true`/`false`） |

## 核心计算

### 差异化敏感度公式

```text
adjusted[方案] = clamp(baseScore[方案] + Σ((paramValue[维度]/100 - 0.5) × delta × 2), 0, 100)
```

### 深度模拟增量公式

```text
shift = (currentValue - snapshotValue) / 100 × delta × 2
```

### trade_offs 加权推导

```text
delta_option(d) = Σ(delta_child(d) × path_probability) / Σ(path_probability_for_child)
```

## 应用场景

- 职业决策：跳槽 vs 留守、转行评估
- 教育选择：考研 vs 就业、出国深造
- 投资分析：创业方向、项目选择
- 人生规划：城市选择、生活方式决策
