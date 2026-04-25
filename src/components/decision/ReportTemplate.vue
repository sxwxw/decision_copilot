<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 用户输入的原始问题 */
  userInput: { type: String, default: '' },
  /** 当前选中节点的 pathChain */
  pathChain: { type: Array, default: () => [] },
  /** 匹配到的完整路径 */
  matchedPath: { type: Object, default: null },
  /** 当前参数值 */
  paramValues: { type: Object, default: () => ({}) },
  /** 模型权重 */
  weights: { type: Object, default: () => ({}) },
  /** 方案得分 */
  scores: { type: Object, default: () => ({}) },
  /** 方案列表 */
  options: { type: Array, default: () => [] },
  /** LLM 推荐结论 */
  recommendation: { type: Object, default: null },
})

/** 导出时间 */
const exportTime = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

/** 焦点路径标题 */
const focusPathTitle = computed(() => {
  if (!props.pathChain.length) return ''
  const names = props.pathChain.map(s => s.name)
  return `焦点路径：${names.join(' → ')}`
})

// ── 推荐置信度 ──

/** 方案排名（按得分降序） */
const rankedOptions = computed(() => {
  return props.options
    .map(o => ({
      name: o.name || o,
      score: typeof o === 'object' ? o.score : props.scores[o] ?? 50,
    }))
    .sort((a, b) => b.score - a.score)
})

/** 推荐置信度：基于 Top1 与 Top2 的分差 */
const confidence = computed(() => {
  if (rankedOptions.value.length < 2) return { label: '唯一方案', level: 'high' }
  const [top1, top2] = rankedOptions.value
  const gap = Math.round((top1.score - top2.score) * 10) / 10
  if (gap > 10) return { label: '显著占优', level: 'high' }
  if (gap > 3) return { label: '适度领先', level: 'medium' }
  return { label: '竞争胶着', level: 'low' }
})

/** 备选警示：Top2 落选原因 */
const runnerUpWarning = computed(() => {
  if (rankedOptions.value.length < 2) return ''
  const [top1, top2] = rankedOptions.value
  const gap = Math.round((top1.score - top2.score) * 10) / 10
  return `备选方案「${top2.name}」得分 ${top2.score}，与首选相差 ${gap} 分，置信度：${confidence.value.label}`
})

// ── 归因矩阵 ──

/** 归因矩阵数据：(paramValue - 50) × delta × 2 */
const attributionMatrix = computed(() => {
  const paramValues = props.paramValues
  const weights = props.weights

  // 收集所有带 trade_offs 的维度
  const dimSet = new Set()
  for (const opt of props.options) {
    const tradeOffs = (typeof opt === 'object' ? opt.logic_payload?.trade_offs : []) || []
    for (const t of tradeOffs) {
      dimSet.add(t.dimension)
    }
  }

  const dims = [...dimSet]
  const optList = props.options.map(o => ({
    name: o.name || o,
    tradeOffs: (typeof o === 'object' ? o.logic_payload?.trade_offs : []) || [],
    score: typeof o === 'object' ? o.score : props.scores[o] ?? 50,
  })).sort((a, b) => b.score - a.score)

  const rows = dims.map(dim => {
    const cells = optList.map(opt => {
      const t = opt.tradeOffs.find(tt => tt.dimension === dim)
      if (!t) return { value: 0, optName: opt.name }
      const pv = paramValues[dim] ?? 50
      const impact = (pv - 50) * t.delta * 2 / 100
      return { value: Math.round(impact * 100) / 100, optName: opt.name }
    })

    // 找绝对值最大的单元格（用于 ★ 标记）
    let maxAbs = 0
    let maxIdx = -1
    cells.forEach((c, i) => {
      if (Math.abs(c.value) > maxAbs) {
        maxAbs = Math.abs(c.value)
        maxIdx = i
      }
    })
    if (maxIdx >= 0) cells[maxIdx].isDecisive = true

    return { dim, cells }
  })

  return { rows, dims: optList.map(o => o.name) }
})

// ── 安全边际（风险压测） ──

/** 安全边际计算 */
const safetyMargins = computed(() => {
  const result = []
  for (const step of props.pathChain) {
    const threshold = step.logic?.threshold || step.logic_payload?.threshold
    if (!threshold || !Object.keys(threshold)) continue

    for (const [dim, thr] of Object.entries(threshold)) {
      const current = props.paramValues[dim] ?? 50
      const margin = current - thr
      let status, label
      if (margin > 15) { status = 'robust'; label = '稳健 (Robust)' }
      else if (margin > 5) { status = 'tight'; label = '紧平衡 (Tight)' }
      else { status = 'fragile'; label = '脆弱 (Fragile)' }

      result.push({
        stepName: step.name,
        dimension: dim,
        currentValue: current,
        threshold: thr,
        margin: Math.round(margin * 100) / 100,
        status,
        label,
      })
    }
  }
  return result
})

/** 安全边际推论文案 */
const stressNarrative = computed(() => {
  if (!safetyMargins.value.length) return ''

  const critical = safetyMargins.value
    .filter(m => m.status === 'fragile' || m.status === 'tight')
    .sort((a, b) => a.margin - b.margin)

  if (!critical.length) {
    const min = safetyMargins.value.reduce((a, b) => a.margin < b.margin ? a : b)
    return `当前各维度安全边际充足，最窄余量为「${min.dimension}」的 ${min.margin} 分。`
  }

  const c = critical[0]
  return `当前「${c.dimension}」的安全边际仅 ${c.margin} 分，属${c.label}状态。若波动超过 10%，该路径将进入中断预警区。`
})

const paramDeltas = computed(() => {
  return Object.entries(props.paramValues).map(([name, value]) => {
    const delta = value - 50
    return { name, value, delta, weight: props.weights[name] ?? 0 }
  })
})

/** 竖向时间轴步骤 */
const pdfSteps = computed(() => {
  return props.pathChain.map((step, idx) => ({
    title: step.name,
    step: idx,
    score: step.displayValue ?? step.score ?? 50,
    impact: step.meta?.key_impact || step.logic_payload?.key_impact || '',
    status: step.logic?.threshold ? assessStepRisk(step) : 'neutral',
  }))
})

/** 单步骤风险判定 */
function assessStepRisk(step) {
  const threshold = step.logic?.threshold
  if (!threshold || !Object.keys(threshold).length) return 'neutral'

  const gaps = Object.entries(threshold).map(([dim, thr]) => ({
    dim,
    gap: (props.paramValues[dim] ?? 50) - thr,
  }))

  const failing = gaps.filter(g => g.gap < 0)
  if (!failing.length) return 'safe'
  if (failing.length >= 2) return 'high-risk'
  return 'tight'
}

/** 机会成本 */
const opportunityCost = computed(() => {
  const leaf = props.pathChain[props.pathChain.length - 1]
  return leaf?.logic_payload?.opportunity_cost || leaf?.meta?.opportunity_cost || ''
})

// ── 方案能力对比（CSS 条形图） ──

/** 各方案在各维度的实际表现（基于 trade_offs + paramValues） */
const dimensionProfiles = computed(() => {
  const paramValues = props.paramValues

  // 收集所有维度
  const dimSet = new Set()
  for (const opt of props.options) {
    const tradeOffs = (typeof opt === 'object' ? opt.logic_payload?.trade_offs : []) || []
    for (const t of tradeOffs) dimSet.add(t.dimension)
  }
  const dims = [...dimSet]
  if (!dims.length) return { dims: [], profiles: [] }

  const optList = props.options.map(o => ({
    name: o.name || o,
    tradeOffs: (typeof o === 'object' ? o.logic_payload?.trade_offs : []) || [],
    score: typeof o === 'object' ? o.score : props.scores[o] ?? 50,
  }))

  // 不同方案用不同灰度
  const grayColors = ['#000', '#555', '#888', '#aaa', '#bbb']

  // 计算每个方案在各维度的表现（50 + 偏移）
  const profiles = optList.map((opt, optIdx) => {
    const dimValues = dims.map(dim => {
      const t = opt.tradeOffs.find(tt => tt.dimension === dim)
      if (!t) return { dim, value: 50, color: grayColors[optIdx] }
      const pv = paramValues[dim] ?? 50
      const adjusted = 50 + (pv - 50) * t.delta * 2 / 100
      return { dim, value: Math.round(adjusted * 10) / 10, color: grayColors[optIdx] }
    })
    return { name: opt.name, dimValues, color: grayColors[optIdx] }
  })

  return { dims, profiles }
})

// ── 高风险 Step 深度解析 ──

/** 找出安全边际最低的 Step */
const highestRiskStep = computed(() => {
  if (!safetyMargins.value.length) return null

  // 按 stepName 聚合，取最低 margin
  const stepMap = {}
  for (const m of safetyMargins.value) {
    if (!stepMap[m.stepName]) stepMap[m.stepName] = { name: m.stepName, margin: m.margin, items: [] }
    stepMap[m.stepName].items.push(m)
    if (m.margin < stepMap[m.stepName].margin) {
      stepMap[m.stepName].margin = m.margin
    }
  }

  const steps = Object.values(stepMap)
  if (!steps.length) return null

  const riskiest = steps.reduce((a, b) => a.margin < b.margin ? a : b)
  return riskiest
})

/** 对冲建议模板 */
const hedgeSuggestion = computed(() => {
  const step = highestRiskStep.value
  if (!step || !step.items.length) return ''

  // 找 margin 最低的维度
  const weakest = step.items.reduce((a, b) => a.margin < b.margin ? a : b)

  if (weakest.margin < 0) {
    return `「${weakest.dimension}」当前值 ${weakest.currentValue} 已低于阈值 ${weakest.threshold}，缺口 ${Math.abs(weakest.margin)} 分。建议在「${step.name}」环节预留 15%~20% 的缓冲资源以对冲该风险。`
  }
  if (weakest.margin <= 5) {
    return `「${weakest.dimension}」的安全边际仅 ${weakest.margin} 分。若该维度表现下滑超过 ${(Math.abs(weakest.margin) * 0.1).toFixed(0)}%，建议考虑降级替代方案。`
  }
  return `「${weakest.dimension}」的安全边际 ${weakest.margin} 分，处于可接受区间。但仍建议定期复核该指标的实际表现。`
})
</script>

<template>
  <div class="report-root">
    <!-- ====== Section 1: 决策背景与参数快照 ====== -->
    <section class="report-section section-context">
      <!-- 页眉 -->
      <div class="report-header">
        <div class="header-line-thick"></div>
        <div class="header-line-thin"></div>
        <h1 class="report-title">PREMIUM DECISION REPORT</h1>
        <p class="report-subtitle">导出时间：{{ exportTime }}</p>
      </div>

      <!-- 焦点路径 -->
      <div class="focus-path">
        {{ focusPathTitle }}
      </div>

      <!-- 决策结论摘要（定音鼓） -->
      <div v-if="rankedOptions.length" class="decision-summary">
        <div class="ds-top-row">
          <span class="ds-rank-badge">1</span>
          <span class="ds-name">{{ rankedOptions[0].name }}</span>
          <span class="ds-score">{{ rankedOptions[0].score }}</span>
          <span class="ds-confidence" :class="`conf-${confidence.level}`">{{ confidence.label }}</span>
        </div>
        <div v-if="recommendation?.analysis" class="ds-analysis">
          {{ recommendation.analysis }}
        </div>
        <div v-if="runnerUpWarning" class="ds-warning">
          <strong>备选警示：</strong>{{ runnerUpWarning }}
        </div>
      </div>

      <!-- 决策背景 -->
      <div class="report-block">
        <h2 class="section-heading">决策背景</h2>
        <p class="section-text">{{ userInput || '未提供决策问题' }}</p>
      </div>

      <!-- 参数快照 -->
      <div class="report-block">
        <h2 class="section-heading">参数配置</h2>
        <table class="param-table">
          <thead>
            <tr>
              <th>维度</th>
              <th>权重</th>
              <th>当前值</th>
              <th>默认值</th>
              <th>偏移</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paramDeltas" :key="p.name">
              <td>{{ p.name }}</td>
              <td>{{ (p.weight * 100).toFixed(0) }}%</td>
              <td>{{ p.value }}</td>
              <td>50</td>
              <td :class="p.delta > 0 ? 'delta-positive' : p.delta < 0 ? 'delta-negative' : ''">
                {{ p.delta > 0 ? '+' : '' }}{{ p.delta }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 方案能力对比 -->
      <div v-if="dimensionProfiles.profiles.length" class="report-block capability-compare">
        <h2 class="section-heading">方案能力模型</h2>
        <div class="profile-legend">
          <span v-for="(prof, idx) in dimensionProfiles.profiles" :key="prof.name" class="legend-item">
            <span class="legend-color" :style="{ background: prof.color }"></span>
            <span class="legend-name">{{ prof.name }}</span>
          </span>
        </div>
        <div class="profile-grid">
          <div v-for="prof in dimensionProfiles.profiles" :key="prof.name" class="profile-row">
            <div class="profile-name">{{ prof.name }}</div>
            <div class="profile-bars">
              <div v-for="dv in prof.dimValues" :key="dv.dim" class="profile-bar-group">
                <div class="bar-label">{{ dv.dim }}</div>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :style="{ width: dv.value + '%', background: prof.color }"
                  ></div>
                </div>
                <div class="bar-value">{{ dv.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="report-section section-timeline">
      <div class="report-header">
        <div class="header-line-thick"></div>
        <div class="header-line-thin"></div>
        <h1 class="report-title">路径推演</h1>
      </div>

      <div class="timeline">
        <div v-for="(s, idx) in pdfSteps" :key="idx" class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-line" v-if="idx < pdfSteps.length - 1"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-step-label">Step {{ s.step }}</span>
              <span class="timeline-title">{{ s.title }}</span>
              <span class="timeline-score">{{ s.score }}</span>
            </div>
            <div v-if="s.impact" class="timeline-impact">{{ s.impact }}</div>
            <div class="timeline-status" :class="`status-${s.status}`">
              {{ s.status === 'safe' ? '稳健' : s.status === 'tight' ? '紧平衡' : s.status === 'high-risk' ? '高风险' : '中性' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 风险压测（安全边际） -->
      <div v-if="safetyMargins.length" class="stress-test">
        <h2 class="section-heading">安全边际</h2>
        <table class="margin-table">
          <thead>
            <tr>
              <th>环节</th>
              <th>维度</th>
              <th>当前值</th>
              <th>阈值</th>
              <th>余量</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in safetyMargins" :key="m.stepName + m.dimension">
              <td>{{ m.stepName }}</td>
              <td>{{ m.dimension }}</td>
              <td>{{ m.currentValue }}</td>
              <td>{{ m.threshold }}</td>
              <td>{{ m.margin }}</td>
              <td :class="`margin-${m.status}`">{{ m.label }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="stressNarrative" class="stress-narrative">
          {{ stressNarrative }}
        </div>
      </div>

      <!-- 高风险 Step 深度解析 -->
      <div v-if="highestRiskStep" class="stress-details">
        <h2 class="section-heading">压力测试：{{ highestRiskStep.name }}</h2>
        <div class="stress-detail-grid">
          <div class="stress-metrics">
            <div class="stress-metric">
              <span class="metric-label">瓶颈维度</span>
              <span class="metric-value">{{ highestRiskStep.items.reduce((a, b) => a.margin < b.margin ? a : b).dimension }}</span>
            </div>
            <div class="stress-metric">
              <span class="metric-label">最低余量</span>
              <span class="metric-value" :class="`margin-${highestRiskStep.items.reduce((a, b) => a.margin < b.margin ? a : b).status}`">
                {{ highestRiskStep.margin }} 分
              </span>
            </div>
          </div>
          <div class="stress-hedge">
            <strong>对冲策略：</strong>
            <p>{{ hedgeSuggestion }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ====== Section 3: 执行摘要与归因 ====== -->
    <section class="report-section section-summary">
      <div class="report-header">
        <div class="header-line-thick"></div>
        <div class="header-line-thin"></div>
        <h1 class="report-title">执行摘要</h1>
      </div>

      <!-- 方案排名 -->
      <div class="report-block">
        <h2 class="section-heading">方案排名</h2>
        <table class="rank-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>方案</th>
              <th>得分</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(opt, idx) in rankedOptions" :key="opt.name">
              <td class="rank-num">{{ idx + 1 }}</td>
              <td>{{ opt.name }}</td>
              <td class="rank-score">{{ opt.score }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 归因矩阵 -->
      <div v-if="attributionMatrix.rows.length" class="report-block">
        <h2 class="section-heading">归因矩阵</h2>
        <table class="matrix-table">
          <thead>
            <tr>
              <th>维度</th>
              <th v-for="dim in attributionMatrix.dims" :key="dim">{{ dim }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in attributionMatrix.rows" :key="row.dim">
              <td class="dim-label">{{ row.dim }}</td>
              <td v-for="cell in row.cells" :key="cell.optName" class="matrix-cell" :class="{
                'cell-positive': cell.value > 0,
                'cell-negative': cell.value < 0,
                'cell-zero': cell.value === 0,
                'cell-decisive': cell.isDecisive,
              }">
                {{ cell.value === 0 ? '—' : cell.value }}
                <span v-if="cell.isDecisive" class="decisive-star">★</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- LLM 分析 -->
      <div v-if="recommendation?.analysis" class="report-block">
        <h2 class="section-heading">AI 分析</h2>
        <p class="section-text">{{ recommendation.analysis }}</p>
      </div>
      <div v-if="recommendation?.delta_analysis" class="report-block">
        <h2 class="section-heading">增量分析</h2>
        <p class="section-text">{{ recommendation.delta_analysis }}</p>
      </div>

      <!-- 机会成本 -->
      <div v-if="opportunityCost" class="report-block footnote">
        <strong>机会成本：</strong>{{ opportunityCost }}
      </div>

      <!-- 免责声明 -->
      <div class="disclaimer">
        本报告基于动态逻辑模型生成。由于市场环境的非线性变化，建议将此推演作为战略参考，而非唯一执行依据。
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── 基础 ── */
.report-root {
  width: 210mm;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #333;
  background: #fff;
  line-height: 1.6;
}

.report-section {
  min-height: 297mm;
  padding: 25mm;
  box-sizing: border-box;
  background: #fff;
}

/* ── 页眉 ── */
.report-header {
  margin-bottom: 20px;
}

.header-line-thick {
  height: 2px;
  background: #000;
}

.header-line-thin {
  height: 1px;
  background: #ccc;
  margin-top: 2px;
}

.report-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 2px;
  margin: 16px 0 4px;
  color: #000;
}

.report-subtitle {
  font-size: 12px;
  color: #888;
  margin: 0;
}

/* ── 焦点路径 ── */
.focus-path {
  font-size: 13px;
  color: #888;
  font-style: italic;
  margin-bottom: 16px;
}

/* ── Section 标题 ── */
.section-heading {
  font-size: 15px;
  font-weight: 700;
  border-left: 3px solid #000;
  padding-left: 10px;
  margin: 0 0 12px;
  color: #000;
}

.section-text {
  font-size: 13px;
  color: #555;
  margin: 0;
}

.report-block {
  margin-bottom: 16px;
  page-break-inside: avoid;
}

/* ── 决策结论摘要（定音鼓） ── */
.decision-summary {
  background: #F5F5F5;
  border-left: 4px solid #000;
  padding: 16px 18px;
  margin-bottom: 16px;
}

.ds-top-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.ds-rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: #000;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.ds-name {
  font-size: 16px;
  font-weight: 700;
  color: #000;
}

.ds-score {
  font-size: 20px;
  font-weight: 800;
  color: #333;
  margin-left: auto;
}

.ds-confidence {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  letter-spacing: 0.5px;
}

.conf-high { background: #000; color: #fff; }
.conf-medium { background: #ccc; color: #333; }
.conf-low { background: #999; color: #fff; }

.ds-analysis {
  font-size: 12px;
  color: #555;
  line-height: 1.6;
  margin-bottom: 8px;
}

.ds-warning {
  font-size: 11px;
  color: #888;
}

.ds-warning strong {
  color: #333;
}

/* ── 参数表格 ── */
.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.param-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 2px solid #000;
  font-weight: 600;
  color: #000;
}

.param-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #e5e7eb;
  color: #555;
}

.delta-positive {
  font-weight: 700;
  color: #000;
}

.delta-negative {
  color: #999;
}

/* ── 风险压测（安全边际） ── */
.stress-test {
  margin-top: 16px;
}

.margin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.margin-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 2px solid #000;
  font-weight: 600;
  color: #000;
}

.margin-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #e5e7eb;
  color: #555;
}

.margin-robust { color: #000; font-weight: 700; }
.margin-tight { color: #666; font-weight: 600; }
.margin-fragile { color: #999; font-weight: 400; }

.stress-narrative {
  background: #F5F5F5;
  border-left: 3px solid #666;
  padding: 10px 14px;
  font-size: 12px;
  color: #555;
  line-height: 1.6;
  margin-top: 10px;
}

/* ── 竖向时间轴 ── */
.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
  page-break-inside: avoid;
}

.timeline-dot {
  position: absolute;
  left: -24px;
  top: 4px;
  width: 10px;
  height: 10px;
  background: #000;
}

.timeline-line {
  position: absolute;
  left: -19px;
  top: 14px;
  width: 1px;
  height: calc(100% - 10px);
  background: #ccc;
}

.timeline-content {
  padding: 10px 14px;
  background: #F5F5F5;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.timeline-step-label {
  font-size: 10px;
  color: #888;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #000;
}

.timeline-score {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  margin-left: auto;
}

.timeline-impact {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.timeline-status {
  font-size: 11px;
  font-weight: 600;
}

.status-safe { color: #000; }
.status-tight { color: #666; }
.status-high-risk { color: #999; }
.status-neutral { color: #888; }

/* ── 排名表格 ── */
.rank-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.rank-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 2px solid #000;
  font-weight: 600;
  color: #000;
}

.rank-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  color: #555;
}

.rank-num {
  font-weight: 700;
  color: #000;
}

.rank-score {
  font-weight: 700;
  color: #000;
}

/* ── 归因矩阵 ── */
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  table-layout: fixed;
}

.matrix-table th {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 2px solid #000;
  font-weight: 600;
  color: #000;
}

.matrix-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
  color: #555;
  vertical-align: middle;
}

.matrix-table .dim-label {
  font-weight: 600;
  color: #333;
  width: 120px;
}

.matrix-cell {
  position: relative;
}

.cell-positive {
  font-weight: 700;
  color: #000;
}

.cell-negative {
  font-weight: 300;
  color: #999;
}

.cell-zero {
  color: #ccc;
}

.cell-decisive {
  position: relative;
}

.decisive-star {
  font-size: 10px;
  color: #000;
  margin-left: 3px;
}

/* ── 脚注（机会成本） ── */
.footnote {
  background: #F5F5F5;
  border-left: 3px solid #999;
  padding: 10px 14px;
  font-size: 12px;
  color: #555;
  margin-top: auto;
}

.footnote strong {
  color: #333;
}

/* ── 免责声明 ── */
.disclaimer {
  margin-top: 32px;
  padding-top: 12px;
  border-top: 1px solid #ccc;
  font-size: 10px;
  color: #999;
  line-height: 1.5;
  text-align: center;
}

/* ── 方案能力对比 ── */
.capability-compare {
  margin-top: 8px;
}

.profile-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #555;
}

.legend-color {
  width: 12px;
  height: 3px;
  display: inline-block;
}

.profile-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.profile-row:last-child {
  border-bottom: none;
}

.profile-name {
  font-size: 12px;
  font-weight: 700;
  color: #000;
  min-width: 60px;
  padding-top: 2px;
}

.profile-bars {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px 12px;
}

.profile-bar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bar-label {
  font-size: 10px;
  color: #888;
}

.bar-track {
  height: 8px;
  background: #F5F5F5;
  position: relative;
}

.bar-fill {
  height: 100%;
  transition: width 0.2s;
  min-width: 2px;
}

.bar-value {
  font-size: 10px;
  font-weight: 600;
  color: #555;
}

/* ── 高风险 Step 深度解析 ── */
.stress-details {
  margin-top: 16px;
}

.stress-detail-grid {
  display: flex;
  gap: 16px;
}

.stress-metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: #F5F5F5;
}

.stress-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 18px;
  font-weight: 800;
  color: #000;
}

.stress-hedge {
  flex: 1.5;
  padding: 14px;
  background: #F5F5F5;
  border-left: 3px solid #000;
  font-size: 12px;
  color: #555;
  line-height: 1.7;
}

.stress-hedge strong {
  color: #000;
  font-size: 11px;
}

.stress-hedge p {
  margin: 4px 0 0;
}
</style>
