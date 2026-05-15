<script setup>
import { computed } from 'vue'

const props = defineProps({
  nexus: { type: Object, default: null },
})

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
      return { label: '人工核验', desc: '需重点查看"条件依赖"和"敏感性警示"' }
    case 'low':
      return { label: '重置模型', desc: '输入数据有误或逻辑严重冲突，建议重新运行流水线' }
    default:
      return { label: '', desc: '' }
  }
})
</script>

<template>
  <div class="nexus-report">
    <div v-if="!nexus" class="nexus-empty">
      <p>请先完成深度验证以生成综合报告</p>
    </div>
    <template v-else>
      <div class="nexus-summary">
        <h4 class="nexus-section-title">执行摘要</h4>
        <p>{{ nexus.executive_summary }}</p>
      </div>
      <div class="nexus-recommendation">
        <h4 class="nexus-section-title">推荐方案</h4>
        <p>{{ nexus.recommendation }}</p>
      </div>
      <div v-if="nexus.key_insights?.length" class="nexus-insights">
        <h4 class="nexus-section-title">关键洞察</h4>
        <ul>
          <li v-for="(ins, i) in nexus.key_insights" :key="i">{{ ins }}</li>
        </ul>
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
</style>
