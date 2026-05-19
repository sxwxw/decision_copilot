# Spec: see-rollback-strategy

## 新增需求

### 需求:内循环精确弹回

系统 SHALL 支持根据 Devil-model 审查报告的 `target_step` 字段，对 SEE 子管线进行定点局部重试，而非重跑整个 SEE。

#### 场景:target_step=1 权重/变量问题
- **当** Devil-model 审查意见中包含 `target_step: 1` 标签
- **那么** 系统重跑 SEE Step 1（注入 Devil 修正意见），并标记 Step 2 和 Step 3 为 stale

#### 场景:target_step=2 因果树问题
- **当** Devil-model 审查意见中包含 `target_step: 2` 标签
- **那么** 系统冻结 Step 1 状态不变，仅重跑 SEE Step 2（注入 Devil 修正意见），并标记 Step 3 为 stale

#### 场景:target_step=3 路径/推荐问题
- **当** Devil-model 审查意见中包含 `target_step: 3` 标签
- **那么** 系统冻结 Step 1 和 Step 2 状态不变，仅重跑 SEE Step 3（注入 Devil 修正意见）

#### 场景:级联顺延自动执行
- **当** 某个上游 SEE 子步被重跑
- **那么** 其下游所有 stale 子步自动顺延执行，无需外部触发

#### 场景:内循环最多执行 1 次
- **当** 内循环已执行过一次
- **那么** 系统 MUST 跳过内循环，记录 innerLoopSkipped = true（保持现有行为不变）

### 需求:外循环全局重塑

系统 SHALL 支持当 Nexus 置信度 < 60 时，从 SEE Step 1 开始完整重跑整个子管线。

#### 场景:Nexus 置信度低触发重跑
- **当** 外回路 Nexus 步骤返回 confidence_level < 60 且 outerLoopCount < 5
- **那么** 系统清除当前 SEE 所有中间状态，从 Step 1 到 Step 3 完整重跑

#### 场景:败因上下文注入
- **当** 外循环重跑 SEE 子管线
- **那么** 系统将 Nexus 反馈的失效原因包装为"全局环境约束"，注入到 Step 1、Step 2 和 Step 3 的 prompt 中

### 需求:SEE 中间结果持久化

系统 SHALL 将 SEE 子管线每步的原始文本输出和解析后的 JSON 片段存入 `pipelineState`。

#### 场景:每步完成后持久化
- **当** SEE 子步（Step 1/2/3）完成且 Parser 解析成功
- **那么** pipelineState 中记录 `{ raw_text, parsed_json, status: "frozen", version }`

#### 场景:stale 状态标记
- **当** 内循环或外循环触发，标记某些子步需要重跑
- **那么** pipelineState 中对应子步的 status 设为 "stale"

#### 场景:Pipeline resume 保留 SEE 状态
- **当** 调用 `POST /pipeline/:id/resume` 恢复管线
- **那么** 系统从 pipelineState 中读取最新的 SEE 中间状态，跳过已完成且 frozen 的子步
