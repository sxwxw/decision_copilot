# spec: decision-core

## 新增需求

### 需求:分数归因动态组装

系统 SHALL 从 `logic_payload.trade_offs` 动态组装分数归因文本，而非使用硬编码中文字符串。

#### 场景:动态生成归因文本
- **当** 用户查看某选项的分数变化归因
- **那么** 系统根据该选项 `logic_payload.trade_offs` 数组中的维度信息，动态组装解释文本

#### 场景:处理缺失的 trade_offs
- **当** 某选项没有 `logic_payload.trade_offs` 或该数组为空
- **那么** 展示默认归因文本（如"暂无详细归因信息"）
