<script setup>
import { computed } from 'vue'

const props = defineProps({
  decision: { type: Object, required: true },
})

const emit = defineEmits(['click'])

const confidenceType = computed(() => {
  const c = props.decision.confidence
  if (c >= 85) return 'high'
  if (c >= 60) return 'medium'
  return 'low'
})

const confidenceLabel = computed(() => {
  const c = props.decision.confidence
  if (!c) return '—'
  return `${c}%`
})

function onClick() {
  emit('click', props.decision.id)
}
</script>

<template>
  <div class="decision-card" @click="onClick">
    <div class="card-header">
      <div class="card-tags">
        <el-tag
          v-for="tag in decision.tags"
          :key="tag"
          size="small"
          type="info"
          plain
        >
          {{ tag }}
        </el-tag>
        <el-tag v-if="decision.isDemo" size="small" effect="plain" class="demo-tag">
          示例
        </el-tag>
      </div>
      <span class="card-date">{{ decision.createdAt }}</span>
    </div>

    <h3 class="card-title">{{ decision.title }}</h3>
    <p class="card-desc">{{ decision.description }}</p>

    <div class="card-options">
      <div
        v-for="opt in decision.options"
        :key="opt"
        class="option-row"
        :class="{ 'option-winner': opt === decision.winner }"
      >
        <span class="option-name">{{ opt }}</span>
        <span class="option-score">
          <span v-if="opt === decision.winner" class="winner-dot"></span>
          {{ decision.scores[opt] }}
        </span>
      </div>
    </div>

    <div class="card-footer">
      <span class="winner-label">
        推荐：<strong>{{ decision.winner }}</strong>
      </span>
      <span class="confidence-tag" :class="confidenceType">
        置信度 {{ confidenceLabel }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.decision-card {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.decision-card:hover {
  border-color: var(--accent, #3b82f6);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.demo-tag {
  color: var(--accent, #3b82f6);
  border-color: var(--accent-border, rgba(59, 130, 246, 0.3));
}

.card-date {
  font-size: 12px;
  color: #94a3b8;
}

.card-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-h, #111827);
  margin: 0 0 8px;
}

.card-desc {
  font-size: 13px;
  color: var(--text, #6b7280);
  line-height: 1.6;
  margin: 0 0 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: var(--code-bg, #f9fafb);
  border-radius: 8px;
}

.option-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text, #6b7280);
}

.option-winner {
  font-weight: 600;
  color: var(--text-h, #111827);
}

.option-name {
  flex: 1;
}

.option-score {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--accent, #3b82f6);
}

.winner-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e7eb);
}

.winner-label {
  font-size: 12px;
  color: var(--text, #6b7280);
}

.winner-label strong {
  color: #10b981;
}

.confidence-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.confidence-tag.high {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.confidence-tag.medium {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.confidence-tag.low {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>
