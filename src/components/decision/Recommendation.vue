<script setup>
const props = defineProps({
  recommendation: { type: Object, default: null },
  scores: { type: Object, default: () => ({}) },
  counterfactualActive: { type: Boolean, default: false },
  activeCounterfactual: { type: String, default: null },
  getScoreDiff: { type: Function, default: () => null },
  counterfactuals: { type: Array, default: () => [] },
})

const emit = defineEmits(['applyCounterfactual', 'resetCounterfactual'])
</script>

<template>
  <div v-if="recommendation" class="recommendation">
    <h3>推荐结论</h3>

    <div class="rank-list">
      <div v-for="(item, idx) in recommendation.rank" :key="item.option" class="rank-item">
        <span class="rank-num">{{ idx + 1 }}</span>
        <div class="rank-info">
          <span class="rank-option">{{ item.option }}</span>
          <div class="rank-scores">
            <span class="rank-score">{{ scores[item.option] ?? item.score }} 分</span>
            <template v-if="getScoreDiff">
              <span
                v-if="getScoreDiff(item.option)"
                class="score-diff"
                :class="getScoreDiff(item.option).diff >= 0 ? 'up' : 'down'"
              >
                <el-tag :type="getScoreDiff(item.option).diff >= 0 ? 'success' : 'danger'" size="small" effect="plain">
                  {{ getScoreDiff(item.option).diff >= 0 ? '↑' : '↓' }}
                  {{ Math.abs(getScoreDiff(item.option).diff) }}
                </el-tag>
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div class="analysis">
      <p>{{ recommendation.analysis }}</p>
    </div>
  </div>
  <div v-else class="recommendation placeholder">
    <p>提交决策问题后将显示推荐结论</p>
  </div>
</template>

<style scoped>
.recommendation {
  padding: 16px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text-h, #1a1a2e);
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--code-bg, #f5f5f5);
  transition: background 0.3s;
}
.rank-item.highlight {
  background: var(--accent-bg, rgba(99, 102, 241, 0.1));
}
.rank-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.rank-option {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h, #1a1a2e);
}
.rank-scores {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rank-score {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #6366f1);
}
.score-diff {
  font-size: 12px;
}
.analysis {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text, #555);
  padding: 12px;
  border-radius: 8px;
  background: var(--code-bg, #f5f5f5);
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
