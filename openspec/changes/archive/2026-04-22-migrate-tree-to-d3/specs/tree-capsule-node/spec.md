# spec: tree-capsule-node

## 新增需求

### 需求:胶囊卡片节点渲染

系统必须将决策树的每个节点渲染为 160px × 48px 的胶囊形卡片，包含以下视觉元素：
- 左侧：置信度环形进度（SVG circle + stroke-dasharray），表示从根节点到该节点的路径概率
- 中间：节点名称文本（完整显示，不换行）
- 右侧或底部：节点分数值
- 背景色或标识色由 eventType 决定：positive 为绿色，negative 为红色，neutral 为灰色

#### 场景:渲染根节点
- **当** 决策树数据加载完成
- **那么** 根节点渲染为胶囊卡片，置信度环显示 100%，背景为默认色

#### 场景:渲染 positive 事件节点
- **当** 节点的 eventType 为 "positive"
- **那么** 节点卡片使用绿色背景或绿色左边框标识

#### 场景:渲染 negative 事件节点
- **当** 节点的 eventType 为 "negative"
- **那么** 节点卡片使用红色背景或红色左边框标识

#### 场景:渲染 neutral 事件节点
- **当** 节点的 eventType 为 "neutral"
- **那么** 节点卡片使用灰色背景或灰色左边框标识

#### 场景:置信度环显示
- **当** 节点具有 probability 值
- **那么** 置信度环的填充面积与该概率成正比（stroke-dashoffset = C * (1 - p)，C = 2πr）
