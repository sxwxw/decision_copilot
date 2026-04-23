<script setup>
const props = defineProps({
  value: { type: Number, default: 0 },
  label: { type: String, default: '' },
  highlight: { type: Boolean, default: false },
})
</script>

<template>
  <div class="metric-card" :class="{ highlight }">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}</div>
    <div class="metric-bar">
      <div class="metric-fill" :style="{ width: value + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, #e5e4e7);
  background: var(--bg, #fff);
}
.metric-card.highlight {
  border-color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.04);
}
.metric-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}
.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-h, #1a1a2e);
  margin-bottom: 6px;
}
.metric-bar {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}
.metric-fill {
  height: 100%;
  background: var(--accent, #6366f1);
  border-radius: 3px;
  transition: width 0.4s ease;
}
</style>
