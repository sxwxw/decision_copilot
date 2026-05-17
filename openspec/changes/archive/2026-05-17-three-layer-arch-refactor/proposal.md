## 为什么

当前系统过度依赖 LLM 进行定量计算（概率评估、权重分配），导致：1) 算力浪费 2) 黑盒感 3) 数理错误（如路径概率和≠1.0）。需要将确定性计算从语义层剥离，建立清晰的代码与 LLM 权力边界。

## 变更内容

- **新增三层权力边界**：LLM 仅输出定性因果标签，确定性代码负责数值映射与拓扑校验
- **升级双回路管线**：V2 外回路增加"静态校验+信号压制+Nexus 批判"三锁机制
- **前端体验优化**：展示影响方向与高亮，避免高频跳动的黑盒分数
- **内回路拦截增强**：定量校验 error/warning 可触发修正回溯，最多 1 次

## 功能 (Capabilities)

### 新增功能
- `semantic-layer`: LLM 语义层约束——Prompt 改造为仅输出定性标签（强正向/弱负向等），禁止直接输出概率与权重数值
- `deterministic-mapping`: 确定性映射层——定性标签到量化初始值的静态映射引擎 + 拓扑错误拦截网关
- `v2-lockdown`: V2 外回路三锁机制——静态代码验证、置信度强力压制、Nexus 显式批判
- `frontend-sandbox`: 主观偏好沙盘层——影响方向展示、高亮标记、避免黑盒分数高频跳动

### 修改功能
- `pipeline-engine`: 管线执行逻辑变更——内回路触发条件扩展、V2 外回路三锁流程、校验结果注入
- `sensitivity-engine`: 敏感性分析展示变更（已隐藏 Tab，需清理相关依赖）

## 影响

- `server/routes/decision.js` - 管线执行逻辑重构
- `src/shared/modelValidator.js` - 新增拓扑错误拦截 + 归一化逻辑
- `server/prompts/decisionModel.js` - 所有 Prompt 重写为定性标签约束
- `src/composables/useDecisionModel.js` - 前端状态管理调整
- `src/components/decision/NexusReport.vue` - 置信度展示增强
- `src/components/decision/PathDetail.vue` - 敏感性分析 Tab 已移除
