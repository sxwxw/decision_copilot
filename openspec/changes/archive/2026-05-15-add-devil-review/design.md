## 上下文

AI-Decision-Engine 有一个 DEVIL Agent，专门攻击模型使其更强：挑战排名第一的选项、为最后一名辩护、找出数据不一致、标记偏置。

## 目标 / 非目标

**目标：**
- 新增 DEVIL prompt，要求 LLM 对已有模型进行对抗性审查
- 前端新增审查面板展示挑战列表
- 深度模拟完成后自动触发

**非目标：**
- 不实现自动修正（DEVIL 只报告，不修改模型数据）
- 不引入多个审查 Agent（仅 DEVIL 一个）

## 决策

### 1. 触发时机

- 深度模拟（蒙特卡洛）完成后自动运行
- 用户可手动点击"重新审查"触发

### 2. 展示位置

底部面板新增第三个 tab：[路径详情] [敏感性分析] [审查]

### 3. 偏置类型

继承 AI-Decision-Engine 的 5 种 + 新增 3 种业务决策相关类型：
survivorship, anchoring, hallucination, prior_misspecification, optimism_bias, recency_bias, scope_neglect

## 风险 / 权衡

[风险] DEVIL 输出可能过于技术化，普通用户不理解
缓解：UI 使用中文通俗语言展示，隐藏技术细节

[风险] 增加一次 LLM 调用，延长等待时间
缓解：DEVIL 在后台异步运行，不阻塞用户交互
