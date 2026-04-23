# spec: decision-core

## 需求

### 前端三栏布局

- 系统 SHALL 提供 `/decision` 路由页面
- 页面 SHALL 采用三栏 Flex 布局：输入区（左 25%）、参数面板（中 25%）、结果区（右 50%）
- 三栏之间 SHALL 有视觉分割和独立滚动

### 输入区

- 系统 SHALL 提供多行文本输入框用于用户描述决策问题
- 系统 SHALL 提供「提交建模」按钮触发 LLM 建模流程
- 系统 SHALL 在建模加载期间显示 loading 状态

### 参数面板（元数据驱动）

- 系统 SHALL 根据 LLM 返回的 variables 数组动态渲染参数控件
- 系统 SHALL 支持 slider（权重滑块）和 select（变量选择器）两种控件类型
- 系统 SHALL 提供「重新模拟」按钮，支持用户调参后触发后端深度推演

### 决策树可视化

- 系统 SHALL 使用 D3.js tree 图表展示决策树
- 系统 SHALL 支持点击树节点触发路径详情展示
- 系统 SHALL 在点击节点时高亮从根到该节点的路径
- 组件 SHALL 为纯可视化层，不包含概率计算或业务逻辑
- 组件 SHALL 通过 `id` 匹配 `selectedNode`（替代原有的 `name + year` 匹配）

### 决策树组件通用契约

- 系统 SHALL 定义 `treeData` 节点标准契约，包含以下字段：
  - `id`（string|number）：节点唯一标识，用于 `selectedNode` 精准查找
  - `name`（string）：显示文字（不带业务前缀如"第N年："）
  - `step`（number）：层级深度，0 = 根节点
  - `score`（number）：节点分值
  - `status`（string|null）：事件类型（success/warning/error/neutral）
  - `probability`（number）：0-1 累积概率
  - `isDashed`（boolean）：连线是否为虚线

### 数据适配器

- 系统 SHALL 在 `useDecisionModel.js` 中通过 `adaptTree` 函数将 LLM 输出的原始数据标准化为组件契约
- 适配器 SHALL 为每个节点生成唯一 `id`
- 适配器 SHALL 去除 `name` 中"第N年："前缀
- 适配器 SHALL 根据 `step` 自动设置 `isDashed`（step >= 2 为虚线）

### 路径详情

- 系统 SHALL 在用户点击决策树节点后展示该路径的详情
- 路径详情 SHALL 包含：概率、量化指标（收入/成长/风险/幸福指数）、解释文本

### 推荐结论

- 系统 SHALL 在结果区底部展示推荐结论
- 推荐结论 SHALL 包含综合评分排名和可解释分析文本

### 计算分工

- 系统 SHALL 在后端（LLM）完成首次决策建模
- 系统 SHALL 在前端完成用户调参后的本地权重重算（秒级响应）
- 前端本地重算 SHALL 仅更新分数排序，不重新生成路径或解释
