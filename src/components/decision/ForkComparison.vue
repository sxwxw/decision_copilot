<script setup>
import { computed } from 'vue'
import { ElTag, ElEmpty } from 'element-plus'

const props = defineProps({
  pathChain: { type: Array, default: () => [] },
  /** 当前选中的节点 */
  node: { type: Object, default: null },
  /** 用户当前最高权重的偏好参数 */
  topParam: { type: String, default: '' },
  /** 获取调参后动态分数 */
  getAdjustedScore: { type: Function, default: () => 50 },
})

/** 从 pathChain 中提取面包屑路径（不含当前节点） */
const breadcrumb = computed(() => props.pathChain.slice(0, -1))

/** 当前节点的子分支列表 */
const branches = computed(() => props.node?.children || [])

/** 获取子节点的条件概率（取自节点自身的 probability，即 LLM 评估的条件概率） */
function getAdjustedChildProb(child) {
  if (child.probability === null || child.probability === undefined) return null
  return child.probability
}
function getBranchTradeoffs(child) {
  return child.logic_payload?.trade_offs || props.node?.logic_payload?.trade_offs || []
}

/** 计算关键分歧变量 */
const divergenceKey = computed(() => {
  const branchList = branches.value
  if (!branchList.length) return null

  // 收集所有子分支的 trade_offs
  const allTradeoffs = branchList.map(getBranchTradeoffs)
  // 如果全部为空，无数据
  const hasData = allTradeoffs.some(t => t.length > 0)
  if (!hasData) return null

  // 合并所有维度
  const dimensions = new Set()
  for (const tos of allTradeoffs) {
    for (const t of tos) {
      dimensions.add(t.dimension)
    }
  }

  // 计算每个维度的极差（max delta - min delta）
  let maxRange = 0
  let keyDim = ''
  for (const dim of dimensions) {
    const deltas = []
    for (const tos of allTradeoffs) {
      const found = tos.find(t => t.dimension === dim)
      if (found) deltas.push(found.delta)
    }
    if (deltas.length >= 2) {
      const range = Math.max(...deltas) - Math.min(...deltas)
      if (range > maxRange) {
        maxRange = range
        keyDim = dim
      }
    }
  }

  if (!keyDim) return null
  return { dimension: keyDim, range: Math.round(maxRange * 100) / 100 }
})

/** 前端模板拼接的决策建议 */
const suggestion = computed(() => {
  const node = props.node
  if (!node?.logic_payload) return ''
  const lp = node.logic_payload
  const topParam = props.topParam || '核心偏好'
  const branchList = branches.value

  // 按事件性质分组
  const positive = branchList.filter(b => b.status === 'positive' || b.status === 'neutral')
  const negative = branchList.filter(b => b.status === 'negative' || b.status === 'error')

  // 正向分支中选概率最高的
  const bestPositive = positive.length
    ? positive.reduce((a, b) => getAdjustedChildProb(b) > getAdjustedChildProb(a) ? b : a, positive[0])
    : null
  // 负向分支中选概率最高的
  const bestNegative = negative.length
    ? negative.reduce((a, b) => getAdjustedChildProb(b) > getAdjustedChildProb(a) ? b : a, negative[0])
    : null

  let text = `已进入「${node.name}」。关键考量：${lp.key_impact || '综合权衡'}。`
  if (bestPositive) {
    const prob = Math.round(getAdjustedChildProb(bestPositive) * 100)
    if (topParam) text += `结合你的偏好（${topParam}），`
    text += `建议关注「${bestPositive.name}」路径（${prob}%）。`
  }
  if (bestNegative && getAdjustedChildProb(bestNegative) > 0.4) {
    const prob = Math.round(getAdjustedChildProb(bestNegative) * 100)
    text += `需警惕「${bestNegative.name}」（${prob}%），建议提前评估。`
  }
  return text
})
</script>

<template>
  <div class="fork-comparison">
    <!-- 面包屑路径 -->
    <div v-if="breadcrumb.length" class="breadcrumb">
      <span v-for="(n, i) in breadcrumb" :key="n.id" class="bc-item">
        {{ n.name }}
        <span v-if="i < breadcrumb.length - 1" class="bc-arrow">→</span>
      </span>
    </div>

    <!-- 当前节点标题 -->
    <h3 class="fork-title">
      分叉路口：<span>{{ node?.name }}</span>
      <el-tag v-if="node?.logic_payload" :type="
        node.logic_payload.risk_level === '低' ? 'success' :
        node.logic_payload.risk_level === '高' ? 'danger' : 'warning'
      " size="small">
        风险 {{ node.logic_payload.risk_level }}
      </el-tag>
    </h3>

    <!-- 敏感度标识 -->
    <div v-if="divergenceKey" class="sensitivity-indicator">
      关键分歧：<span class="key-dimension">{{ divergenceKey.dimension }}</span>（极差 <span class="key-range">{{ divergenceKey.range }}</span>）
    </div>

    <!-- 分叉对比卡片 -->
    <div v-if="branches.length" class="fork-cards">
      <div
        v-for="(child, idx) in branches"
        :key="child.id"
        class="fork-card"
        :class="child.status || ''"
      >
        <div class="fork-card-header">
          <span class="fork-name">{{ child.name }}</span>
        </div>

        <div class="fork-stats">
          <div class="fork-stat">
            <span class="fork-stat-label">概率</span>
            <span class="fork-stat-value">{{ getAdjustedChildProb(child) != null ? ((getAdjustedChildProb(child)) * 100).toFixed(0) + '%' : '-' }}</span>
          </div>
          <div class="fork-stat">
            <span class="fork-stat-label">分值</span>
            <span class="fork-stat-value">{{ getAdjustedScore(child.name) !== 50 ? getAdjustedScore(child.name) : (child.score ?? 50) }}</span>
          </div>
        </div>

        <!-- logic_payload 决策元数据（优先用子节点自身的，否则用父节点的作为上下文） -->
        <div v-if="child.logic_payload || node?.logic_payload" class="fork-payload">
          <div class="fork-reason">
            <span class="payload-label">核心理由</span>
            <span>{{ child.logic_payload?.primary_reason || node.logic_payload?.primary_reason }}</span>
          </div>
          <div v-if="(child.logic_payload?.trade_offs?.length) || (node.logic_payload?.trade_offs?.length)" class="fork-tradeoffs">
            <div v-for="(t, ti) in (child.logic_payload?.trade_offs || node.logic_payload?.trade_offs)" :key="ti" class="tradeoff-item">
              <span>{{ t.dimension }}</span>
              <el-tag :type="t.delta >= 0 ? 'success' : 'danger'" size="small">
                {{ t.delta >= 0 ? '+' : '' }}{{ t.delta }}
              </el-tag>
            </div>
          </div>
          <div v-if="child.logic_payload?.opportunity_cost || node.logic_payload?.opportunity_cost" class="fork-opportunity">
            <span class="payload-label">机会成本</span>
            <span>{{ child.logic_payload?.opportunity_cost || node.logic_payload?.opportunity_cost }}</span>
          </div>
        </div>
        <div v-else class="fork-no-payload">
          <span class="payload-label">暂无决策元数据</span>
        </div>
      </div>
    </div>

    <!-- 前端模板拼接的决策建议 -->
    <div v-if="suggestion" class="suggestion">
      <p>{{ suggestion }}</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!branches.length" class="placeholder">
      <el-empty description="该节点暂无分叉" :image-size="40" />
    </div>
  </div>
</template>

<style scoped>
.fork-comparison {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

/* 面包屑 */
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.bc-arrow {
  padding: 0 4px;
  color: #cbd5e1;
}

/* 标题 */
.fork-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-h, #1a1a2e);
}

.fork-title span:not([class]) {
  color: var(--accent, #3b82f6);
}

/* 敏感度标识 */
.sensitivity-indicator {
  background: var(--accent-bg, rgba(59, 130, 246, 0.06));
  border-left: 3px solid var(--accent, #3b82f6);
  border-radius: 0 8px 8px 0;
  padding: 8px 12px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--text, #555);
}

.key-dimension {
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

.key-range {
  font-weight: 600;
  color: #d97706;
}

/* 分叉卡片容器 */
.fork-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  margin-bottom: 16px;
  padding-bottom: 4px;
}

.fork-card {
  flex: 0 0 280px;
  min-width: 240px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 14px;
}

.fork-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.fork-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

/* 概率和分值 */
.fork-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.fork-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--code-bg, #f9fafb);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: center;
}

.fork-stat-label {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fork-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

/* logic_payload 元数据 */
.fork-payload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fork-reason,
.fork-opportunity {
  font-size: 12px;
  color: var(--text, #555);
  line-height: 1.5;
}

.payload-label {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.fork-tradeoffs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tradeoff-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.fork-no-payload {
  font-size: 12px;
  color: #cbd5e1;
  text-align: center;
  padding: 12px 0;
}

/* 决策建议 */
.suggestion {
  background: var(--accent-bg, rgba(59, 130, 246, 0.06));
  border-left: 3px solid var(--accent, #3b82f6);
  border-radius: 0 8px 8px 0;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.suggestion p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text, #555);
  margin: 0;
}

/* 空状态 */
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}
</style>
