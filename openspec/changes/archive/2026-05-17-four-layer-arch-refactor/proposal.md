## 为什么

代码库由 AI 辅助生成，模块边界模糊，职责混乱。`useDecisionModel.js` 1469 行承担了状态管理、验证、评分、蒙特卡洛、敏感性分析、Pipeline 编排、持久化等 8+ 个职责。评分公式 `(pv/100 - 0.5) * delta * 2` 散落在 3 个文件 6 处，前后端各有独立版本的 `validateModel/sanitizeModel`。SSE 流无超时、无取消，Devil 异步调用未 await 导致错误静默。这些问题使得新增功能时改一处影响多处，修改风险不可控。

## 变更内容

将前端代码重构为四层架构：视图层（哑组件）→ 状态编排层（Composables）→ 领域核心层（纯 JS 引擎）→ 基础设施层（API/存储/SSE）。拆分 `useDecisionModel.js` 为多个独立引擎，统一评分公式、验证逻辑、概率计算为唯一实现源。修复 SSE 超时/取消、异步 await、NaN 防护、PDF 时间戳等 20+ 个已知设计缺陷。

**非目标**：不修改后端 API 接口、不改变 LLM Prompt、不改变用户可见功能行为、不引入 Pinia（保持 Composables）

## 功能 (Capabilities)

### 新增功能
- `score-engine`: 统一评分计算引擎，唯一实现 `(pv - 50) * delta * 2 / 100` 公式，支持 Decimal.js 精度
- `model-validator`: 统一数据验证/清洗模块，前后端共享，包含 deriveTradeoffs 作为后端补全逻辑
- `tree-adapter`: 决策树结构适配、路径索引、节点匹配逻辑
- `sse-client`: SSE 流管理，支持超时、取消、断线恢复、错误上报
- `storage-service`: localStorage 持久化层，隔离于业务逻辑
- `sensitivity-engine`: 敏感性分析独立引擎，扰动排名稳定性计算
- `prob-normalizer`: 概率归一化工具，解决浮点精度导致概率和偏离 1.0 的问题
- `value-of-information`: 信息价值分析（EVIU），利用蒙特卡洛计算"掌握变量真实值能挽回多少期望损失"，指导用户优先调研
- `simulator-correlation`: 蒙特卡洛变量相关性（Copula），correlation_matrix 由 LLM 在建模时生成，前端只消费

### 修改功能
- `decision-core`: 视图层改为哑组件，业务逻辑上移至状态编排层
- `local-persistence`: 持久化逻辑从 composable 剥离至基础设施层
- `multi-agent-pipeline`: SSE 流管理、超时、错误处理重构
- `monte-carlo-simulation`: NaN/Infinity 防护、分类采样偏置修复、变量相关性（Copula）支持
- `devil-review`: 异步调用链修复、错误上报到 UI
- `sensitivity-analysis`: 从 composable 剥离为独立引擎、信息价值分析（EVIU）集成
- `pdf-export`: 时间戳修复、渲染等待完善

## 影响

**受影响代码**：几乎所有前端文件将被重写或大幅重构
- `src/composables/useDecisionModel.js` → 拆分为 `src/engines/` + `src/composables/useDecisionOrchestrator.js`
- `src/components/decision/` → 重构为哑组件，业务逻辑移除
- `src/utils/` → 新增 `engines/`、`services/` 目录
- `server/routes/decision.js` → 共享 validator 模块
- **不受影响**：后端 API 路由签名、LLM Prompt、用户交互流程
