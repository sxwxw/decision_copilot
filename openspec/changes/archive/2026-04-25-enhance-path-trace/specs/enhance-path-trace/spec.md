# 规范：路径溯源深度增强

## 需求：数据摘要

### 场景：显示综合评分

**Given** 用户点击了一个叶子节点（Step 2 或更深）  
**When** PathDetail 进入 trace 模式  
**Then** 显示"到达总概率：X%"和"综合评分：Y"

### 场景：综合评分反映实时偏移

**Given** 用户拖动过参数滑块  
**When** 展示综合评分  
**Then** 评分应基于当前参数值对叶子节点原始 value 进行偏移计算

## 需求：路径链中间标注

### 场景：箭头标注 key_impact

**Given** pathChain 中有带 `logic_payload` 的节点  
**When** 渲染路径链  
**Then** 在节点间的箭头上展示该节点的 `key_impact`

### 场景：delta 趋势箭头

**Given** 节点有 `logic_payload.trade_offs`  
**When** 渲染路径链标注  
**Then** 在 key_impact 后附加 ↑ 或 ↓ 趋势箭头（由 trade_offs delta 总和决定方向）

## 需求：实时风险评估

### 场景：最大缺口定位

**Given** 当前路径节点的 `threshold` 是一个多维对象  
**When** 计算风险状态  
**Then** 对所有维度计算 `currentValue - threshold`，选出最负的缺口作为主风险

### 场景：所有维度达标

**Given** 所有维度的 `currentValue >= threshold`  
**When** 展示风险状态  
**Then** 显示绿色"稳健"文案

### 场景：存在不达标维度

**Given** 至少一个维度的 `currentValue < threshold`  
**When** 展示风险状态  
**Then** 显示红色/橙色预警文案，指出缺口最大的维度名、当前值、阈值

### 场景：多个维度不达标

**Given** 两个以上维度的 `currentValue < threshold`  
**When** 展示风险状态  
**Then** 显示"风险累计"文案，列出所有不达标维度

### 场景：threshold 全为 0 或缺失

**Given** 节点没有 threshold 或所有 threshold 值为 0  
**When** 计算风险状态  
**Then** 判定为"无风险环境"，隐藏风险评估区

### 场景：滑块拖动实时更新

**Given** 用户拖动参数滑块  
**When** paramValues 变化  
**Then** 风险状态（红边/绿边、预警文案）实时响应

## 需求：路径级归因

### 场景：路径级推动力

**Given** pathChain 中有多个节点  
**When** 计算核心推动力  
**Then** 遍历所有节点的 trade_offs，找到 `(paramValue - 50) × delta` 绝对值最大的环节

### 场景：归因文案细化到节点

**When** 展示核心推动力  
**Then** 文案格式为"推动力：由于您对「维度」的偏好，[节点名] 环节的贡献被显著放大/缩小"

## 需求：机会成本展示

### 场景：叶子节点有机会成本

**Given** 叶子节点的 `logic_payload.opportunity_cost` 存在  
**When** 渲染路径溯源  
**Then** 在底部展示机会成本文案

## 需求：数据注入

### 场景：enrichPathChain 注入 timeline 字段

**Given** `matchedPath.timeline` 存在  
**When** `selectNode` 被调用  
**Then** pathChain 中每个节点（跳过根节点）注入 `logic.impact`、`logic.threshold`、`logic.probability`

### 场景：不修改 adaptTree

**Given** enrichPathChain 在 selectNode 中调用  
**When** 执行数据注入  
**Then** adaptTree 保持不变，不受影响
