# spec: devil-simulate

## 新增需求

### 需求:DEVIL-SIMULATE Prompt
系统必须提供 `DECISION_DEVIL_SIMULATE_PROMPT`，用于在 SIMULATE 步骤后质疑概率假设和分布参数。

#### 场景:Prompt 攻击目标
- 当 LLM 接收蒙特卡洛仿真结果和模型数据
- 那么 Prompt 必须要求质疑"分布参数（均值、标准差）的依据是什么"
- 那么 Prompt 必须要求检查"是否存在被忽略的极端风险场景（如融资冻结、政策变化、竞争对手提前入场）"
- 那么 Prompt 必须要求检查"模拟结果是否过于平滑（方差过小导致确定性结论）"
- 那么 Prompt 必须要求引用行业基准数据（如适用）对比模型假设

### 需求:DEVIL-SIMULATE 输出结构
DEVIL-SIMULATE 必须返回以下 JSON 结构：

#### 场景:审查结果格式
- 当 DEVIL-SIMULATE 完成
- 那么必须返回 `{ "questionable_assumptions": [...], "tail_risks": [...], "baseline_gaps": [...] }`
- 其中 `questionable_assumptions` 是存疑的概率假设（至少 1 条，最多 3 条）
- 其中 `tail_risks` 是极端风险场景列表
- 其中 `baseline_gaps` 是模型假设与行业基准的差距

### 需求:DEVIL-SIMULATE 约束
DEVIL-SIMULATE 必须遵守以下约束：

#### 场景:约束遵守
- 当 LLM 生成 DEVIL-SIMULATE 输出
- 那么禁止 Markdown 格式，必须返回纯净 JSON
- 那么禁止虚构不存在的数据或基准
- 那么 severity 只能是 "high" | "medium" | "low"
