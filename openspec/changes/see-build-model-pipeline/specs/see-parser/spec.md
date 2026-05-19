# Spec: see-parser

## 新增需求

### 需求:SEE Parser — 中间格式转 JSON

系统 SHALL 提供代码 Parser 函数，将 SEE 子管线 3 个步骤输出的 Markdown DSL 转换为目标 JSON Schema（与现有 `DECISION_MODEL_PROMPT` 输出格式完全一致）。

#### 场景:解析变量块
- **当** Parser 接收到 `## VARIABLES_START ##` 到 `## VARIABLES_END ##` 之间的文本
- **那么** Parser 解析每行 `- Variable:` 及其子行，生成 `variables` 和 `weights` 数组

#### 场景:解析因果树
- **当** Parser 接收到 Markdown 缩进树文本
- **那么** Parser 根据缩进层级（0=Root, 2=Option, 4=Event, 6=State）构建 `treeData` 嵌套结构

#### 场景:解析 PAYLOAD 块
- **当** Parser 扫描到 `[PAYLOAD]` 到 `[END_PAYLOAD]` 之间的内容
- **那么** Parser 将键值对归属到当前节点，生成 `logic_payload` 对象

#### 场景:解析路径块
- **当** Parser 接收到 `## PATHS_START ##` 到 `## PATHS_END ##` 之间的文本
- **那么** Parser 生成 `paths` 数组，包含 id、name、probability_label、explanation、timeline

#### 场景:解析评分块
- **当** Parser 接收到 `## SCORES_START ##` 到 `## SCORES_END ##` 之间的文本
- **那么** Parser 生成 `scores` 对象

#### 场景:解析推荐块
- **当** Parser 接收到 `## RECOMMENDATION_START ##` 到 `## RECOMMENDATION_END ##` 之间的文本
- **那么** Parser 生成 `recommendation.analysis` 字段

#### 场景:容错解析 — 空格不精确
- **当** LLM 输出的缩进树空格数不精确（如 3 个空格而非 2 个）
- **那么** Parser 使用正则匹配关键字（`- Variable:`、`- Option:`、`- Event:`、`- State:`）而非精确缩进计数来判断层级

#### 场景:容错解析 — 缺失字段
- **当** LLM 输出中缺少某个非关键字段
- **那么** Parser 使用合理默认值填充（如缺失 risk_level 默认为"中"），而非抛出异常

#### 场景:输出完整 JSON
- **当** Parser 完成所有块的解析
- **那么** 输出的 JSON 必须包含 options、variables、weights、treeData、paths、recommendation、scores 全部顶层字段
