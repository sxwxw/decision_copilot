<script setup>
import { computed } from 'vue'

const props = defineProps({
  nexus: { type: Object, default: null },
  sensitivity: { type: Object, default: null },
  monteCarlo: { type: Object, default: null },
  devilResult: { type: Object, default: null },
  pipelineDevil: { type: Object, default: null },
})

const emit = defineEmits([])

// ── Confidence ──

const confidenceValue = computed(() => {
  const c = props.nexus?.confidence_level
  if (typeof c === 'number') return c
  if (typeof c === 'string') {
    const n = Number(c)
    if (!isNaN(n)) return n
    if (c === '高') return 90
    if (c === '中') return 70
    if (c === '低') return 30
  }
  return null
})

const confidenceLevel = computed(() => {
  const v = confidenceValue.value
  if (v === null) return 'unknown'
  if (v > 85) return 'high'
  if (v >= 60) return 'medium'
  return 'low'
})

const confidenceLabel = computed(() => {
  if (confidenceValue.value === null) return '—'
  return `${confidenceValue.value}%`
})

const actionGuide = computed(() => {
  switch (confidenceLevel.value) {
    case 'high':
      return { label: '直接决策', desc: '逻辑链条闭环，可作为行动依据' }
    case 'medium':
      return { label: '人工核验', desc: '建议查看下方"注意事项"，结合实际情况综合判断' }
    case 'low':
      return { label: '重置模型', desc: '输入数据有误或逻辑严重冲突，建议重新运行流水线' }
    default:
      return { label: '', desc: '' }
  }
})


// ── Monte Carlo ──

const mcRanking = computed(() => {
  const mc = props.monteCarlo
  if (!mc || !mc.ranking) return null
  return mc.ranking
})

const mcOptionResults = computed(() => {
  const mc = props.monteCarlo
  if (!mc || !mc.optionResults) return null
  return mc.optionResults
})

// ── Sensitivity ──

const stabilityLabel = {
  stable: '排名稳定',
  partially_stable: '部分稳定',
  unstable: '排名不稳定',
}

const stabilityTagType = {
  stable: 'success',
  partially_stable: 'warning',
  unstable: 'danger',
}

const unstableVars = computed(() => {
  if (!props.sensitivity?.flip_count_by_var) return []
  return Object.entries(props.sensitivity.flip_count_by_var)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
})

// ── Devil review ──

const winnerVuln = computed(() => {
  // Pipeline 模式：从 devil-nexus 阶段提取
  const pd = props.pipelineDevil
  if (pd && pd['devil-nexus']?.winner_vulnerability) return pd['devil-nexus'].winner_vulnerability
  // 旧版 /devil 路由
  return props.devilResult?.winner_vulnerability || null
})

const loserDef = computed(() => {
  const pd = props.pipelineDevil
  if (pd && pd['devil-nexus']?.loser_defense) return pd['devil-nexus'].loser_defense
  return props.devilResult?.loser_defense || null
})
</script>

<template>
  <div class="nexus-report">
    <div v-if="!nexus" class="nexus-empty">
      <p>请先完成深度验证以生成综合报告</p>
    </div>
    <template v-else>
      <div v-if="nexus.override_reason" class="data-error-alert">
        <el-alert title="量化基础不通过" type="warning" :closable="false" show-icon>
          <template #default>{{ nexus.override_reason }}</template>
        </el-alert>
      </div>
      <div class="nexus-summary">
        <h4 class="nexus-section-title">执行摘要</h4>
        <p>{{ nexus.executive_summary }}</p>
      </div>
      <div class="nexus-recommendation">
        <h4 class="nexus-section-title">推荐方案</h4>
        <p>{{ nexus.recommendation }}</p>
      </div>

      <!-- 蒙特卡洛仿真 -->
      <div v-if="mcRanking" class="nexus-monte-carlo">
        <h4 class="nexus-section-title">蒙特卡洛仿真（P10 / P50 / P90）</h4>
        <div class="mc-table">
          <div v-for="item in mcRanking" :key="item.name" class="mc-row">
            <span class="mc-rank">#{{ item.rank }}</span>
            <span class="mc-name">{{ item.name }}</span>
            <span class="mc-stat">
              P10: <strong>{{ mcOptionResults?.[item.name]?.p10 ?? '-' }}</strong>
            </span>
            <span class="mc-stat mc-median">
              P50: <strong>{{ mcOptionResults?.[item.name]?.p50 ?? '-' }}</strong>
            </span>
            <span class="mc-stat">
              P90: <strong>{{ mcOptionResults?.[item.name]?.p90 ?? '-' }}</strong>
            </span>
            <span class="mc-sigma">σ = {{ mcOptionResults?.[item.name]?.sigma ?? '-' }}</span>
          </div>
        </div>
      </div>

      <div v-if="nexus.key_insights?.length" class="nexus-insights">
        <h4 class="nexus-section-title">关键洞察</h4>
        <ul>
          <li v-for="(ins, i) in nexus.key_insights" :key="i">{{ ins }}</li>
        </ul>
      </div>

      <!-- 敏感性分析 -->
      <div v-if="sensitivity" class="nexus-sensitivity">
        <h4 class="nexus-section-title">敏感性分析</h4>
        <div class="sensitivity-stability-row">
          <el-tag :type="stabilityTagType[sensitivity.stability]" size="small">
            {{ stabilityLabel[sensitivity.stability] || sensitivity.stability }}
          </el-tag>
          <span class="sensitivity-stability-desc">
            {{ sensitivity.total_flips }} 次排名变化 / {{ sensitivity.total_perturbations }} 次扰动
          </span>
        </div>
        <div v-if="sensitivity.gap_pct !== null" class="sensitivity-gap-row">
          <span class="sensitivity-gap-label">Top 1 vs Top 2：</span>
          <span class="sensitivity-gap-value">{{ (sensitivity.gap_pct * 100).toFixed(1) }}%</span>
        </div>
        <div v-if="unstableVars.length" class="nexus-unstable-vars">
          <div v-for="v in unstableVars" :key="v.name" class="unstable-var-item">
            <span class="var-name">{{ v.name }}</span>
            <el-tag type="danger" size="small">{{ v.count }} 次翻转</el-tag>
          </div>
        </div>
        <p v-else-if="sensitivity.total_flips === 0" class="sensitivity-stable-hint">
          所有变量在 ±20% 扰动下均未引起排名变化，结果稳健。
        </p>
      </div>

      <!-- 冠军脆弱 / 末位辩护 -->
      <div v-if="winnerVuln || loserDef" class="nexus-devil-review">
        <div v-if="winnerVuln" class="devil-review-item">
          <h4 class="nexus-section-title">冠军脆弱</h4>
          <p>{{ winnerVuln }}</p>
        </div>
        <div v-if="loserDef" class="devil-review-item">
          <h4 class="nexus-section-title">末位辩护</h4>
          <p>{{ loserDef }}</p>
        </div>
      </div>

      <div class="nexus-confidence" :class="`level-${confidenceLevel}`">
        <h4 class="nexus-section-title">置信度</h4>
        <div class="confidence-display">
          <span class="confidence-value">{{ confidenceLabel }}</span>
          <span class="confidence-action-tag" :class="confidenceLevel">{{ actionGuide.label }}</span>
          <p class="confidence-desc">{{ actionGuide.desc }}</p>
        </div>
      </div>
      <div v-if="nexus.caveats?.length" class="nexus-caveats">
        <h4 class="nexus-section-title">注意事项</h4>
        <ul>
          <li v-for="(c, i) in nexus.caveats" :key="i">{{ c }}</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nexus-report {
  padding: 16px;
}

.nexus-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.nexus-summary,
.nexus-recommendation,
.nexus-insights,
.nexus-confidence,
.nexus-caveats {
  margin-bottom: 16px;
}

.nexus-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-h, #1a1a2e);
}

.nexus-summary p,
.nexus-recommendation p {
  font-size: 13px;
  color: var(--text, #555);
  line-height: 1.6;
  margin: 0;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.nexus-insights ul,
.nexus-caveats ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nexus-insights li,
.nexus-caveats li {
  font-size: 13px;
  color: var(--text, #555);
  padding: 8px 12px;
  border-left: 3px solid #3b82f6;
  margin-bottom: 6px;
  background: #f9fafb;
  border-radius: 0 6px 6px 0;
}

/* Confidence level styling */
.confidence-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.confidence-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-h, #1a1a2e);
}

.confidence-action-tag {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.confidence-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

/* High: >85% 绿色细线条 */
.nexus-confidence.level-high .confidence-action-tag {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

/* Medium: 60-85% 黄色警示 */
.nexus-confidence.level-medium .confidence-action-tag {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
  border: 1px solid #d97706;
}

/* Low: <60% 橙红虚线框 */
.nexus-confidence.level-low {
  border: 2px dashed #ef4444;
  border-radius: 8px;
  padding: 12px;
  margin: 0 0 16px;
}

.nexus-confidence.level-low .confidence-action-tag {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid #ef4444;
}

/* Remodel hint removed */

.remodel-btn {
  margin-top: 8px;
}

.data-error-alert {
  margin-bottom: 16px;
}

/* Monte Carlo */
.nexus-monte-carlo {
  margin-bottom: 16px;
}

.mc-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  background: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
}

.mc-rank {
  font-weight: 700;
  color: var(--accent, #3b82f6);
  min-width: 28px;
}

.mc-name {
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
  min-width: 60px;
}

.mc-stat {
  color: #64748b;
}

.mc-stat strong {
  color: var(--text-h, #1a1a2e);
}

.mc-stat.mc-median {
  color: var(--accent, #3b82f6);
}

.mc-stat.mc-median strong {
  color: var(--accent, #3b82f6);
}

.mc-sigma {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
}

/* Sensitivity */
.nexus-sensitivity {
  margin-bottom: 16px;
}

.sensitivity-stability-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.sensitivity-stability-desc {
  font-size: 13px;
  color: #64748b;
}

.sensitivity-gap-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sensitivity-gap-label {
  font-size: 13px;
  color: #64748b;
}

.sensitivity-gap-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

.nexus-unstable-vars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.unstable-var-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  font-size: 13px;
}

.var-name {
  font-weight: 500;
  color: var(--text-h, #1a1a2e);
}

.sensitivity-stable-hint {
  font-size: 13px;
  color: #059669;
  background: #f0fdf4;
  border-radius: 6px;
  padding: 10px 12px;
  margin: 0;
}

/* Devil review */
.nexus-devil-review {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.devil-review-item {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
}

.devil-review-item p {
  font-size: 13px;
  color: var(--text, #555);
  line-height: 1.5;
  margin: 0;
  padding-left: 10px;
  border-left: 3px solid #d97706;
}
</style>
