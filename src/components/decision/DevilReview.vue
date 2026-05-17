<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  /** 旧版 /devil 路由结果（向后兼容） */
  devilResult: { type: Object, default: null },
  /** 流水线产出的 4 阶段 DEVIL 结果：{ 'devil-framework': {...}, 'devil-model': {...}, ... } */
  pipelineDevil: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['rerun'])

const severityOrder = { high: 0, medium: 1, low: 2 }
const severityTagType = { high: 'danger', medium: 'warning', low: 'info' }
const severityLabel = { high: '高', medium: '中', low: '低' }

const expandedCards = ref(new Set())

function toggleExpand(idx) {
  const s = expandedCards.value
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expandedCards.value = new Set(s)
}

// ── 阶段标签映射 ──
const STAGE_LABELS = {
  'devil-framework': '📋 框架审查',
  'devil-model': '🔬 模型审查',
  'devil-simulate': '📊 仿真审查',
  'devil-nexus': '🎯 结论审查',
}

// ── 多阶段聚合 ──

/** 是否使用流水线模式（4 阶段 DEVIL） */
const isPipelineMode = computed(() => {
  return !!props.pipelineDevil && Object.keys(props.pipelineDevil).length > 0
})

/** 各阶段 DEVIL 输出列表，按 stage 排序 */
const devilStages = computed(() => {
  if (!isPipelineMode.value) return []
  const order = ['devil-framework', 'devil-model', 'devil-simulate', 'devil-nexus']
  return order
    .filter(key => props.pipelineDevil[key])
    .map(key => ({ key, label: STAGE_LABELS[key], data: props.pipelineDevil[key] }))
})

/** 聚合所有阶段的 issues / questions / questionable_assumptions / dependencies 为统一的 challenge 列表 */
const allChallenges = computed(() => {
  const list = []
  if (!isPipelineMode.value) return list

  for (const stage of devilStages.value) {
    const d = stage.data
    if (d.questions) {
      d.questions.forEach(q => {
        list.push({
          stage: stage.key,
          stageLabel: stage.label,
          type: q.type,
          severity: q.severity,
          description: q.description,
          affected_option: null,
          suggestion: null,
        })
      })
    }
    if (d.issues) {
      d.issues.forEach(issue => {
        list.push({
          stage: stage.key,
          stageLabel: stage.label,
          type: issue.type,
          severity: issue.severity,
          description: issue.description,
          affected_option: issue.affected_element || null,
          suggestion: null,
        })
      })
    }
    if (d.questionable_assumptions) {
      d.questionable_assumptions.forEach(a => {
        list.push({
          stage: stage.key,
          stageLabel: stage.label,
          type: 'questionable_assumption',
          severity: a.severity,
          description: `${a.variable}: ${a.issue}`,
          affected_option: null,
          suggestion: null,
        })
      })
    }
    if (d.dependencies) {
      d.dependencies.forEach(dep => {
        list.push({
          stage: stage.key,
          stageLabel: stage.label,
          type: 'premise_dependency',
          severity: dep.severity,
          description: `${dep.premise} → ${dep.risk_if_false}`,
          affected_option: null,
          suggestion: null,
        })
      })
    }
  }

  return [...list].sort(
    (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  )
})

/** 旧版 /devil 路由的 challenges 列表 */
const legacyChallenges = computed(() => {
  if (isPipelineMode.value || !props.devilResult?.challenges) return []
  return [...props.devilResult.challenges].sort(
    (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  )
})

/** 旧版 bias_flags */
const legacyBiasFlags = computed(() => {
  if (isPipelineMode.value) return []
  return props.devilResult?.bias_flags || []
})

/** 旧版 winner_vulnerability */
const legacyWinnerVuln = computed(() => {
  if (isPipelineMode.value) return null
  return props.devilResult?.winner_vulnerability
})

/** 旧版 loser_defense */
const legacyLoserDef = computed(() => {
  if (isPipelineMode.value) return null
  return props.devilResult?.loser_defense
})
</script>

<template>
  <div class="devil-review">
    <!-- ── 流水线模式：4 阶段 ── -->
    <template v-if="isPipelineMode">
      <!-- 聚合 Issues -->
      <section v-if="allChallenges.length" class="devil-section">
        <h4 class="devil-section-title">⚠ 发现 {{ allChallenges.length }} 个问题</h4>
        <div class="devil-challenge-list">
          <div v-for="(ch, idx) in allChallenges" :key="'c-' + idx" class="devil-challenge-item">
            <div class="devil-challenge-header" @click="toggleExpand(idx)">
              <el-tag :type="severityTagType[ch.severity]" size="small">{{ severityLabel[ch.severity] }}</el-tag>
              <el-tag size="small" type="warning" effect="plain" class="devil-stage-tag">{{ ch.stageLabel }}</el-tag>
              <span class="devil-challenge-desc">{{ ch.description }}</span>
              <span class="devil-expand">{{ expandedCards.has(idx) ? '▼' : '▶' }}</span>
            </div>
            <div v-if="expandedCards.has(idx)" class="devil-challenge-body">
              <div v-if="ch.affected_option" class="devil-field">
                影响方案：<el-tag size="small" type="primary">{{ ch.affected_option }}</el-tag>
              </div>
              <div class="devil-field">类型：{{ ch.type }}</div>
              <div v-if="ch.suggestion" class="devil-field devil-suggestion">💡 {{ ch.suggestion }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Tail risks / missing options / failure modes per stage -->
      <div v-for="stage in devilStages" :key="stage.key" class="devil-section">
        <h4 class="devil-section-title">{{ stage.label }} 摘要</h4>
        <div class="devil-summary-box">
          <p v-if="stage.data.summary" class="devil-summary-text">{{ stage.data.summary }}</p>
          <div v-if="stage.data.tail_risks?.length" class="devil-summary-sub">
            <strong>尾部风险：</strong>
            <ul><li v-for="(r, i) in stage.data.tail_risks" :key="i">{{ r }}</li></ul>
          </div>
          <div v-if="stage.data.missing_options?.length" class="devil-summary-sub">
            <strong>遗漏选项：</strong>
            <ul><li v-for="(o, i) in stage.data.missing_options" :key="i">{{ o }}</li></ul>
          </div>
          <div v-if="stage.data.failure_modes?.length" class="devil-summary-sub">
            <strong>失效条件：</strong>
            <ul><li v-for="(f, i) in stage.data.failure_modes" :key="i">{{ f }}</li></ul>
          </div>
          <div v-if="stage.data.sensitivity?.length" class="devil-summary-sub">
            <strong>敏感因素：</strong>
            <ul><li v-for="(s, i) in stage.data.sensitivity" :key="i">{{ s }}</li></ul>
          </div>
          <div v-if="stage.data.biased_variables?.length" class="devil-summary-sub">
            <strong>命名偏差：</strong>
            <ul><li v-for="(v, i) in stage.data.biased_variables" :key="i">{{ v }}</li></ul>
          </div>
        </div>
      </div>
    </template>

    <!-- ── 旧版 /devil 路由模式（向后兼容） ── -->
    <template v-else>
      <!-- Challenges -->
      <section v-if="legacyChallenges.length" class="devil-section">
        <h4 class="devil-section-title">⚠ 发现 {{ legacyChallenges.length }} 个问题</h4>
        <div class="devil-challenge-list">
          <div v-for="(ch, idx) in legacyChallenges" :key="idx" class="devil-challenge-item">
            <div class="devil-challenge-header" @click="toggleExpand(idx)">
              <el-tag :type="severityTagType[ch.severity]" size="small">{{ severityLabel[ch.severity] }}</el-tag>
              <span class="devil-challenge-desc">{{ ch.description }}</span>
              <span class="devil-expand">{{ expandedCards.has(idx) ? '▼' : '▶' }}</span>
            </div>
            <div v-if="expandedCards.has(idx)" class="devil-challenge-body">
              <div v-if="ch.affected_option" class="devil-field">
                影响方案：<el-tag size="small" type="primary">{{ ch.affected_option }}</el-tag>
              </div>
              <div class="devil-field">类型：{{ ch.type }}</div>
              <div v-if="ch.suggestion" class="devil-field devil-suggestion">💡 {{ ch.suggestion }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bias Flags -->
      <section v-if="legacyBiasFlags.length" class="devil-section">
        <h4 class="devil-section-title">🚩 偏置标志</h4>
        <div class="devil-bias-list">
          <div v-for="(flag, idx) in legacyBiasFlags" :key="idx" class="devil-bias-item">
            <el-tag :type="severityTagType[flag.severity]" size="small">{{ severityLabel[flag.severity] }}</el-tag>
            <span class="devil-bias-type">{{ flag.type }}</span>
            <span class="devil-bias-evidence">—— {{ flag.evidence }}</span>
          </div>
        </div>
      </section>

      <!-- Winner Vulnerability -->
      <section v-if="legacyWinnerVuln" class="devil-section">
        <h4 class="devil-section-title">🏆 冠军脆弱性</h4>
        <p class="devil-insight">{{ legacyWinnerVuln }}</p>
      </section>

      <!-- Loser Defense -->
      <section v-if="legacyLoserDef" class="devil-section">
        <h4 class="devil-section-title">🛡 末位辩护</h4>
        <p class="devil-insight">{{ legacyLoserDef }}</p>
      </section>
    </template>

    <!-- Empty / Re-run -->
    <div v-if="!isPipelineMode && !devilResult" class="devil-empty">
      <p v-if="loading">审查中...</p>
      <p v-else>尚无审查结果，请先开始推演。</p>
      <el-button class="devil-rerun-btn" :loading="loading" :disabled="loading" @click="emit('rerun')">运行审查</el-button>
    </div>
    <el-button v-if="!isPipelineMode && devilResult" class="devil-rerun-btn" :loading="loading" :disabled="loading" @click="emit('rerun')">重新审查</el-button>
  </div>
</template>

<style scoped>
.devil-review {
  padding: 16px;
}

.devil-section {
  margin-bottom: 20px;
}

.devil-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--text-h, #1a1a2e);
}

/* Challenge list */
.devil-challenge-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.devil-challenge-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.devil-challenge-item:hover {
  border-color: #93c5fd;
}

.devil-challenge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.devil-challenge-desc {
  font-size: 13px;
  color: var(--text, #555);
  flex: 1;
}

.devil-expand {
  font-size: 10px;
  color: #94a3b8;
  flex-shrink: 0;
}

.devil-challenge-body {
  padding: 8px 12px 12px;
  background: #f9fafb;
  border-top: 1px solid #f0f0f0;
}

.devil-field {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.devil-field:last-child {
  margin-bottom: 0;
}

.devil-suggestion {
  color: #059669;
}

/* Bias flags */
.devil-bias-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.devil-bias-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.devil-bias-type {
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

.devil-bias-evidence {
  font-size: 12px;
  color: #94a3b8;
}

/* Insights */
.devil-insight {
  font-size: 13px;
  color: var(--text, #555);
  background: #fff;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  padding: 10px 12px;
  margin: 0;
}

/* Empty / Re-run */
.devil-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.devil-rerun-btn {
  margin-top: 12px;
  font-size: 13px;
}

/* Stage tag */
.devil-stage-tag {
  font-size: 10px;
}

/* Summary box */
.devil-summary-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
}

.devil-summary-text {
  font-size: 13px;
  color: var(--text, #555);
  margin: 0 0 8px;
  line-height: 1.5;
}

.devil-summary-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
}

.devil-summary-sub strong {
  color: var(--text-h, #1a1a2e);
}

.devil-summary-sub ul {
  margin: 4px 0 0 18px;
  padding: 0;
}

.devil-summary-sub li {
  margin-bottom: 2px;
  line-height: 1.4;
}
</style>
