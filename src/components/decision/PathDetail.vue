<script setup>
import { computed, ref, h, render } from 'vue'
import { ElTag, ElEmpty, ElAlert } from 'element-plus'
import ForkComparison from './ForkComparison.vue'
import ReportTemplate from './ReportTemplate.vue'
import { exportReportToPdf } from '../../utils/exportReport'

const props = defineProps({
  pathChain: { type: Array, default: () => [] },
  matchedPath: { type: Object, default: null },
  node: { type: Object, default: null },
  viewMode: { type: String, default: 'trace' },
  /** 用户最高权重的偏好参数 */
  topParam: { type: String, default: '' },
  /** 获取权重调整后的方案得分 */
  getAdjustedScore: { type: Function, default: () => 50 },
  /** 获取分数差异归因文本 */
  getScoreAttribution: { type: Function, default: () => '' },
  /** LLM 基准分 */
  baseScores: { type: Object, default: () => ({}) },
  /** 推荐结论（含 analysis 分析） */
  recommendation: { type: Object, default: null },
  /** 调整后概率映射 pathId -> probability */
  adjustedProbMap: { type: Object, default: () => ({}) },
  /** 当前参数值 */
  paramValues: { type: Object, default: () => ({}) },
  /** 模型权重 */
  weights: { type: Object, default: () => ({}) },
  /** 用户输入的原始问题 */
  userInput: { type: String, default: '' },
  /** 所有方案列表（用于报告导出） */
  allOptions: { type: Array, default: () => [] },
})

const STATUS_MAP = {
  positive: { type: 'success', label: '+' },
  success: { type: 'success', label: '+' },
  negative: { type: 'danger', label: '-' },
  error: { type: 'danger', label: '-' },
  warning: { type: 'warning', label: '!' },
  neutral: { type: 'info', label: '~' },
}

/** 获取节点调整后的概率：通过 pathIds 从 adjustedProbMap 查找 */
function getAdjustedProb(node) {
  const map = props.adjustedProbMap
  if (!map || !Object.keys(map).length) return null
  const pathIds = node?.pathIds || []
  for (const pid of pathIds) {
    if (map[pid] != null) return map[pid]
  }
  return null
}

/** 是否为叶节点路径溯源模式 */
const isTrace = computed(() => props.viewMode === 'trace')
/** 是否为分叉对比模式 */
const isFork = computed(() => props.viewMode === 'fork-compare')
/** 是否为全局概览模式 */
const isOverview = computed(() => props.viewMode === 'overview')

/** 增量分析文案（深度模拟后展示） */
const deltaAnalysis = computed(() => {
  return props.recommendation?.delta_analysis || ''
})

/** 全局概览：所有方案列表 */
const options = computed(() => {
  if (!props.node?.children) return []
  return props.node.children.map(c => {
    const adjScore = props.getAdjustedScore(c.name) ?? c.score ?? 50
    const baseScore = props.baseScores[c.name] ?? c.score ?? 50
    const diff = adjScore - baseScore
    return {
      id: c.id,
      name: c.name,
      score: adjScore,
      baseScore,
      diff,
      status: c.status,
      logic_payload: c.logic_payload,
      attribution: props.getScoreAttribution(c.name),
    }
  }).sort((a, b) => b.score - a.score).map(c => ({
    ...c,
    score: Math.round(c.score * 100) / 100,
    baseScore: Math.round(c.baseScore * 100) / 100,
    diff: Math.round((c.score - c.baseScore) * 100) / 100,
  }))
})

// ── 路径溯源增强 ──

/** 叶子节点 */
const leafNode = computed(() => {
  if (!isTrace.value || !props.pathChain.length) return null
  return props.pathChain[props.pathChain.length - 1]
})

/** 到达总概率 */
const totalProbability = computed(() => {
  const leaf = leafNode.value
  if (!leaf) return null
  const adj = getAdjustedProb(leaf)
  if (adj != null) return adj
  return leaf.probability ?? null
})

/** 综合评分（整条路径链的实时偏移分数） */
const compositeScore = computed(() => {
  if (!props.pathChain.length) return null

  console.group('[CompositeScore] ===== 综合评分计算 =====')
  console.log('[CompositeScore] paramValues:', props.paramValues)
  console.log('[CompositeScore] pathChain:', props.pathChain.map(s => ({ name: s.name, score: s.score })))

  let baseScore = 0
  let totalOffset = 0

  for (const step of props.pathChain) {
    if (step.score !== undefined) baseScore = step.score

    const tradeOffs = step.logic_payload?.trade_offs || []
    if (tradeOffs.length) {
      console.log(`[CompositeScore] "${step.name}" trade_offs:`, tradeOffs)
    }
    for (const t of tradeOffs) {
      const pv = props.paramValues[t.dimension]
      if (pv !== undefined && typeof pv === 'number') {
        const offset = (pv / 100 - 0.5) * t.delta * 2
        console.log(`  → 维度 "${t.dimension}": param=${pv}, delta=${t.delta}, offset=${offset.toFixed(2)}`)
        totalOffset += offset
      }
    }
  }

  const final = Math.max(0, Math.min(100, Math.round(baseScore + totalOffset)))
  console.log('[CompositeScore] 最终:', final, '(base:', baseScore, ', totalOffset:', totalOffset.toFixed(2), ')')
  console.groupEnd()
  return final
})

/** 路径级归因：找到拉动分数最关键的一环 */
const pathLevelAttribution = computed(() => {
  const paramValues = props.paramValues
  if (!props.pathChain.length || !Object.keys(paramValues).length) return ''

  let maxAbs = 0
  let topNodeName = ''
  let topDim = ''
  let topImpact = 0

  // 跳过根节点（idx=0）
  for (let i = 1; i < props.pathChain.length; i++) {
    const step = props.pathChain[i]
    const tradeOffs = step.logic_payload?.trade_offs || []
    for (const t of tradeOffs) {
      const pv = paramValues[t.dimension]
      if (pv === undefined || typeof pv !== 'number') continue
      const impact = (pv / 100 - 0.5) * t.delta * 2
      if (Math.abs(impact) > Math.abs(maxAbs)) {
        maxAbs = impact
        topNodeName = step.name
        topDim = t.dimension
        topImpact = impact
      }
    }
  }

  if (!topDim) return ''

  const direction = topImpact > 0 ? '正向拉动' : '负向拖累'
  return `由于你对「${topDim}」的偏好，「${topNodeName}」环节被${direction}了 ${Math.abs(topImpact).toFixed(1)} 分`
})

/** 机会成本 */
const opportunityCost = computed(() => {
  const leaf = leafNode.value
  return leaf?.logic_payload?.opportunity_cost || leaf?.meta?.opportunity_cost || ''
})

/** 导出报告 */
const isExporting = ref(false)

async function handleExport() {
  if (isExporting.value) return
  isExporting.value = true

  try {
    const target = document.getElementById('report-target')
    if (!target) {
      console.error('[ExportReport] 未找到 #report-target 容器')
      return
    }

    // 渲染 ReportTemplate 到离屏容器
    const reportNode = h(ReportTemplate, {
      userInput: props.userInput,
      pathChain: props.pathChain,
      matchedPath: props.matchedPath,
      paramValues: props.paramValues,
      weights: props.weights,
      scores: props.baseScores,
      options: props.allOptions,
      recommendation: props.recommendation,
    })
    render(reportNode, target)

    // 等待 DOM 渲染完成
    await new Promise(resolve => requestAnimationFrame(resolve))

    // 导出 PDF
    await exportReportToPdf(target)
  } catch (err) {
    console.error('[ExportReport] 导出失败:', err)
  } finally {
    // 清空离屏容器
    const target = document.getElementById('report-target')
    if (target) render(null, target)
    isExporting.value = false
  }
}

/** 路径链中某节点的 delta 方向（用于箭头标注颜色） */
function getDeltaDirection(step) {
  const tradeOffs = step.logic_payload?.trade_offs || []
  if (!tradeOffs.length) return null
  const sum = tradeOffs.reduce((acc, t) => acc + (t.delta || 0), 0)
  return sum > 0 ? 'up' : sum < 0 ? 'down' : null
}
</script>

<template>
  <!-- 全局概览 -->
  <div v-if="isOverview && options.length" class="path-detail">
    <el-alert
      v-if="deltaAnalysis"
      :title="deltaAnalysis"
      type="info"
      :closable="false"
      show-icon
      class="delta-analysis-alert"
    />
    <h3 class="path-title">方案概览</h3>
    <div class="option-list">
      <div
        v-for="(opt, idx) in options"
        :key="opt.id"
        class="option-card"
        :class="opt.status || ''"
      >
        <div class="option-rank">
          <span class="rank-num">{{ idx + 1 }}</span>
          <span class="rank-name">{{ opt.name }}</span>
        </div>
        <div class="option-score-group">
          <span class="option-score">{{ opt.score }}</span>
          <span class="option-base-score">基准 {{ opt.baseScore }}</span>
          <span
            v-if="Math.abs(opt.diff) > 5"
            class="option-diff"
            :class="opt.diff > 0 ? 'diff-positive' : 'diff-negative'"
          >
            {{ opt.diff > 0 ? '↑' : '↓' }} {{ opt.diff > 0 ? '+' : '' }}{{ opt.diff }}
          </span>
        </div>
        <div v-if="opt.attribution" class="option-attribution">
          {{ opt.attribution }}
        </div>
        <div v-if="opt.logic_payload" class="option-payload">
          <el-tag :type="
            opt.logic_payload.risk_level === '低' ? 'success' :
            opt.logic_payload.risk_level === '高' ? 'danger' : 'warning'
          " size="small">
            风险 {{ opt.logic_payload.risk_level }}
          </el-tag>
          <span class="option-key-impact">{{ opt.logic_payload.key_impact }}</span>
        </div>
      </div>
    </div>
    <div v-if="recommendation?.analysis" class="analysis-card">
      <h4 class="analysis-title">分析</h4>
      <p>{{ recommendation.analysis }}</p>
    </div>
  </div>

  <!-- 分叉对比 -->
  <ForkComparison
    v-else-if="isFork"
    :path-chain="pathChain"
    :node="node"
    :top-param="topParam"
    :adjusted-prob-map="adjustedProbMap"
  />

  <!-- 路径溯源（叶节点） -->
  <div v-else-if="isTrace && pathChain.length" class="path-detail">
    <div class="path-header-row">
      <h3 class="path-title">路径溯源</h3>
      <button class="btn-export-inline" :disabled="isExporting" @click="handleExport">
        {{ isExporting ? '导出中...' : '导出深度分析报告 (PDF)' }}
      </button>
    </div>

    <!-- 数据摘要 -->
    <div class="summary-bar">
      <span class="summary-item">
        到达总概率：<strong>{{ ((totalProbability ?? 0) * 100).toFixed(0) }}%</strong>
      </span>
      <span class="summary-divider">|</span>
      <span class="summary-item">
        综合评分：<strong>{{ compositeScore }}</strong>
        <span class="score-hint">基于当前权重修正</span>
      </span>
    </div>

    <!-- 路径链可视化（带中间标注） -->
    <div class="path-chain">
      <div
        v-for="(step, idx) in pathChain"
        :key="step.id ?? idx"
        class="chain-step"
      >
        <div class="chain-card" :class="[step.status || '']">
          <span class="chain-step-label">Step {{ step.step }}</span>
          <span class="chain-name">{{ step.name }}</span>
          <span class="chain-value">{{ step.score }}</span>
        </div>
        <el-tag
          v-if="step.status"
          :type="STATUS_MAP[step.status]?.type || 'info'"
          size="small"
          effect="plain"
          class="chain-status"
        >
          {{ STATUS_MAP[step.status]?.label }}
        </el-tag>
        <div v-if="idx < pathChain.length - 1" class="chain-bridge">
          <span class="bridge-impact">{{ step.meta?.key_impact }}</span>
          <span
            v-if="getDeltaDirection(step)"
            class="bridge-delta"
            :class="getDeltaDirection(step) === 'up' ? 'delta-up' : 'delta-down'"
          >
            {{ getDeltaDirection(step) === 'up' ? '↑' : '↓' }}
          </span>
          <span class="bridge-arrow">──▶</span>
        </div>
      </div>
    </div>

    <!-- 关键推演归因 + 解释 -->
    <div v-if="pathLevelAttribution || matchedPath?.explanation" class="attribution-grid">
      <div v-if="pathLevelAttribution" class="attr-item">
        <h4>💡 核心推动力</h4>
        <p>{{ pathLevelAttribution }}</p>
      </div>
      <div v-if="matchedPath?.explanation" class="attr-item">
        <h4>📋 路径特征</h4>
        <p>{{ matchedPath.explanation }}</p>
      </div>
    </div>

    <!-- 机会成本 -->
    <div v-if="opportunityCost" class="opportunity-cost-box">
      <strong>机会成本：</strong>{{ opportunityCost }}
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else class="path-detail placeholder">
    <el-empty description="点击决策树节点查看路径详情" :image-size="60" />
  </div>
</template>

<style scoped>
.path-detail {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.path-detail::-webkit-scrollbar {
  width: 6px;
}

.path-detail::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}

.path-detail:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.path-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-h, #1a1a2e);
}

.probability-badge {
  font-size: 13px;
  padding: 6px 10px;
  background: var(--accent-bg, rgba(59, 130, 246, 0.06));
  border-radius: 6px;
  display: inline-block;
  margin-bottom: 14px;
}
.probability-badge strong {
  color: var(--accent, #3b82f6);
}

/* 全局概览 */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px 14px;
  transition: border-color 0.2s;
}

.option-card:hover {
  border-color: var(--accent, #3b82f6);
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.05);
}

.option-rank {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.rank-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent, #3b82f6);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.rank-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

.option-score-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
  gap: 1px;
}

.option-score {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
  line-height: 1.1;
}

.option-base-score {
  font-size: 11px;
  color: #94a3b8;
}

.option-diff {
  font-size: 12px;
  font-weight: 600;
}

.option-diff.diff-positive {
  color: #059669;
}

.option-diff.diff-negative {
  color: #d97706;
}

.option-attribution {
  font-size: 11px;
  color: #64748b;
  max-width: 200px;
  line-height: 1.4;
  text-align: right;
}

.option-payload {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.option-key-impact {
  color: var(--text, #555);
}

/* 数据摘要 */
.summary-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--code-bg, #f9fafb);
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-item {
  font-size: 13px;
  color: var(--text, #555);
}

.summary-item strong {
  color: var(--accent, #3b82f6);
  font-weight: 700;
}

.score-hint {
  font-size: 11px;
  color: #94a3b8;
  margin-left: 4px;
}

.summary-divider {
  color: #d1d5db;
}

/* 路径链 */
.path-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--code-bg, #f9fafb);
  border-radius: 8px;
}

.chain-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chain-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 100px;
  transition: border-color 0.3s, background 0.3s;
}
.chain-card.positive,
.chain-card.success {
  border-color: #059669;
  background: rgba(5, 150, 105, 0.04);
}
.chain-card.negative,
.chain-card.error {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.04);
}
.chain-card.warning {
  border-color: #d97706;
  background: rgba(217, 119, 6, 0.04);
}

.chain-step-label {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.chain-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-h, #1a1a2e);
}

.chain-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

.chain-status {
  font-size: 11px;
}

/* 中间桥接标注 */
.chain-bridge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
}

.bridge-impact {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.bridge-delta {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.delta-up {
  color: var(--accent, #3b82f6);
}

.delta-down {
  color: var(--text-secondary, #9ca3af);
}

.bridge-arrow {
  font-size: 14px;
  color: #cbd5e1;
}

/* 归因网格 */
.attribution-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.attr-item {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
}

.attr-item h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--text-h, #1a1a2e);
}

.attr-item p {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text, #555);
  margin: 0;
}

/* 机会成本 */
.opportunity-cost-box {
  background: var(--code-bg, #f9fafb);
  border-left: 3px solid #f59e0b;
  border-radius: 4px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--text, #555);
}

.opportunity-cost-box strong {
  color: #d97706;
}

/* 导出按钮 */
.path-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-export-inline {
  padding: 6px 14px;
  background: var(--accent, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-export-inline:hover {
  opacity: 0.9;
}

.btn-export-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.analysis-card {
  background: var(--code-bg, #f9fafb);
  border-radius: 8px;
  padding: 14px 16px;
  margin-top: 12px;
}

.analysis-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-h, #1a1a2e);
}

.analysis-card p {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text, #555);
  margin: 0;
}

.delta-analysis-alert {
  margin-bottom: 12px;
}

.placeholder {
  color: #999;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
