<script setup>
import { computed } from 'vue'

const props = defineProps({
  sensitivity: { type: Object, default: null },
  options: { type: Array, default: () => [] },
})

const emit = defineEmits(['run'])

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
</script>

<template>
  <div class="sensitivity-analysis">
    <div v-if="!sensitivity" class="sensitivity-empty">
      <p>分析对每个变量的 ±20% 扰动对排名的影响。</p>
      <button class="sensitivity-run-btn" @click="emit('run')">运行敏感性分析</button>
    </div>

    <template v-else>
      <!-- Ranking stability -->
      <section class="sensitivity-section">
        <h4 class="sensitivity-section-title">排名稳定性</h4>
        <div class="sensitivity-stability-row">
          <el-tag :type="stabilityTagType[sensitivity.stability]" size="large">
            {{ stabilityLabel[sensitivity.stability] || sensitivity.stability }}
          </el-tag>
          <span class="sensitivity-stability-desc">
            {{ sensitivity.total_flips }} 次排名变化 / {{ sensitivity.total_perturbations }} 次扰动
          </span>
        </div>
      </section>

      <!-- Gap between 1st and 2nd -->
      <section v-if="sensitivity.gap_pct !== null" class="sensitivity-section">
        <h4 class="sensitivity-section-title">第一名 vs 第二名差距</h4>
        <div class="sensitivity-gap-row">
          <span class="sensitivity-gap-value">{{ (sensitivity.gap_pct * 100).toFixed(1) }}%</span>
          <span class="sensitivity-gap-desc">
            {{ sensitivity.current_ranking?.[0]?.name }} ({{ sensitivity.current_ranking?.[0]?.score }}分)
            vs
            {{ sensitivity.current_ranking?.[1]?.name }} ({{ sensitivity.current_ranking?.[1]?.score }}分)
          </span>
        </div>
      </section>

      <!-- Current ranking -->
      <section v-if="sensitivity.current_ranking" class="sensitivity-section">
        <h4 class="sensitivity-section-title">当前排名</h4>
        <div class="sensitivity-ranking-list">
          <div v-for="item in sensitivity.current_ranking" :key="item.name" class="sensitivity-ranking-item">
            <span class="sensitivity-rank">#{{ item.rank }}</span>
            <span class="sensitivity-option-name">{{ item.name }}</span>
            <span class="sensitivity-option-score">{{ item.score }} 分</span>
          </div>
        </div>
      </section>

      <!-- Unstable variables -->
      <section v-if="unstableVars.length" class="sensitivity-section">
        <h4 class="sensitivity-section-title">⚠ 易引起排名变化的变量</h4>
        <div class="sensitivity-variables">
          <div v-for="v in unstableVars" :key="v.name" class="sensitivity-variable-item">
            <span class="sensitivity-var-name">{{ v.name }}</span>
            <el-tag type="danger" size="small">{{ v.count }} 次翻转</el-tag>
          </div>
        </div>
      </section>

      <p v-if="!unstableVars.length && sensitivity.total_flips === 0" class="sensitivity-stable-hint">
        所有变量在 ±20% 扰动下均未引起排名变化，说明当前结果较为稳健。
      </p>

      <!-- Re-run button -->
      <button class="sensitivity-rerun-btn" @click="emit('run')">重新分析</button>
    </template>
  </div>
</template>

<style scoped>
.sensitivity-analysis {
  padding: 16px;
}

.sensitivity-section {
  margin-bottom: 16px;
}

.sensitivity-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-h, #1a1a2e);
}

.sensitivity-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.sensitivity-run-btn,
.sensitivity-rerun-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: var(--accent, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.sensitivity-run-btn:hover,
.sensitivity-rerun-btn:hover {
  opacity: 0.9;
}

.sensitivity-stability-row {
  display: flex;
  align-items: center;
  gap: 12px;
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

.sensitivity-gap-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

.sensitivity-gap-desc {
  font-size: 13px;
  color: #64748b;
}

.sensitivity-ranking-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sensitivity-ranking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  font-size: 13px;
}

.sensitivity-rank {
  font-weight: 700;
  color: var(--accent, #3b82f6);
  min-width: 24px;
}

.sensitivity-option-name {
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

.sensitivity-option-score {
  color: #94a3b8;
  margin-left: auto;
}

.sensitivity-variables {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sensitivity-variable-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.sensitivity-var-name {
  font-size: 13px;
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
</style>
