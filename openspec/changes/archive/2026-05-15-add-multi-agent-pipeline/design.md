## 上下文

当前只有一个 prompt（DECISION_MODEL_PROMPT），LLM 一次性生成所有模型数据。

## 目标 / 非目标

**目标：**
- 拆分 5 步流水线：FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS
- 每步独立，支持断点续跑
- SSE 流式推送进度

**非目标：**
- 不引入 9 步完整流水线（AI-Decision-Engine 的做法）
- 不做 ORACLE/ECHO 等社区舆情分析

## 决策

### 1. 每步 Agent 职责

| Agent | 输入 | 输出 |
|-------|------|------|
| FRAMEWORK | 用户问题 | 维度列表、变量框架、场景定义 |
| MODEL-BUILD | FRAMEWORK 输出 + 用户问题 | 决策树 + trade_offs + 分布参数 |
| SIMULATE | MODEL-BUILD 输出 | 蒙特卡洛统计结果 |
| DEVIL | 完整模型 + SIMULATE 结果 | 挑战列表 |
| NEXUS | 以上所有 | 综合报告 |

### 2. SSE 进度推送

```
event: step
data: { step: "framework", status: "running" }
```

### 3. 断点续跑

`pipelineState` 对象存储每步结果，失败后可从断点继续。

## 风险 / 权衡

[风险] 5 次 LLM 调用延迟显著增加
→ 缓解：快速模式仍用单步 MODEL-BUILD，流水线仅在"深度分析"时触发

[风险] SSE 在 Vercel Serverless 上支持有限
→ 缓解：降级方案为 polling（前端定时查询后端状态）
