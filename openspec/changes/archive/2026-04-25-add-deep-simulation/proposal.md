# 变更：深度模拟（二次深度推演）

## 背景
当前 `/simulate` 路由只是用 `DECISION_MODEL_DEEP_PROMPT` 重新生成一个全新的模型，完全忽略用户调整后的参数。深度模拟后滑块被重置为默认值，用户体验断裂。

## 目标
- 深度模拟时，前端将当前 model 和 paramValues 一起发给后端
- 后端 LLM 保持 options 和变量维度不变，基于新参数重构 treeData / paths / scores / recommendation
- 返回新树后，滑块保持用户当前值，不重置
- 新树自带全新的 trade_offs，前端可继续基于新树做微调计算
- 深度模拟按钮在参数偏离时显示视觉提示

## 范围
- 新增 `POST /api/decision/refine` 路由
- 新增 `DECISION_REFINE_PROMPT`
- 前端 `runSimulation` 改为调用 `/refine`
- ParamPanel 深度模拟按钮增加偏离提示
- PathDetail 展示 delta_analysis 文案
