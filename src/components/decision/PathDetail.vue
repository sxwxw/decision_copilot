<script setup>
import { computed } from 'vue'
import { ElTag, ElEmpty } from 'element-plus'
import ForkComparison from './ForkComparison.vue'

const props = defineProps({
  pathChain: { type: Array, default: () => [] },
  matchedPath: { type: Object, default: null },
  node: { type: Object, default: null },
  viewMode: { type: String, default: 'trace' },
  /** 用户最高权重的偏好参数 */
  topParam: { type: String, default: '' },
  /** 获取权重调整后的方案得分 */
  getAdjustedScore: { type: Function, default: () => 50 },
})

const STATUS_MAP = {
  positive: { type: 'success', label: '+' },
  success: { type: 'success', label: '+' },
  negative: { type: 'danger', label: '-' },
  error: { type: 'danger', label: '-' },
  warning: { type: 'warning', label: '!' },
  neutral: { type: 'info', label: '~' },
}

/** 是否为叶节点路径溯源模式 */
const isTrace = computed(() => props.viewMode === 'trace')
/** 是否为分叉对比模式 */
const isFork = computed(() => props.viewMode === 'fork-compare')
/** 是否为全局概览模式 */
const isOverview = computed(() => props.viewMode === 'overview')

/** 全局概览：所有方案列表 */
const options = computed(() => {
  if (!props.node?.children) return []
  return props.node.children.map(c => ({
    id: c.id,
    name: c.name,
    score: props.getAdjustedScore(c.name) ?? c.score ?? 50,
    status: c.status,
    logic_payload: c.logic_payload,
  })).sort((a, b) => b.score - a.score)
})
</script>

<template>
  <!-- 全局概览 -->
  <div v-if="isOverview && options.length" class="path-detail">
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
        <span class="option-score">{{ opt.score }}</span>
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
  </div>

  <!-- 分叉对比 -->
  <ForkComparison
    v-else-if="isFork"
    :path-chain="pathChain"
    :node="node"
    :top-param="topParam"
  />

  <!-- 路径溯源（叶节点） -->
  <div v-else-if="isTrace && pathChain.length" class="path-detail">
    <h3 class="path-title">路径溯源</h3>

    <!-- 到达概率 -->
    <el-tag type="primary" effect="light" class="probability-badge" size="large">
      到达概率：<strong>{{ ((pathChain[pathChain.length - 1]?.probability ?? 0) * 100).toFixed(0) }}%</strong>
    </el-tag>

    <!-- 路径链可视化 -->
    <div class="path-chain">
      <div
        v-for="(n, idx) in pathChain"
        :key="n.id ?? idx"
        class="chain-step"
      >
        <div class="chain-card" :class="n.status || ''">
          <span class="chain-step-label">Step {{ n.step }}</span>
          <span class="chain-name">{{ n.name }}</span>
          <span class="chain-value">{{ n.score }}</span>
        </div>
        <el-tag
          v-if="n.status"
          :type="STATUS_MAP[n.status]?.type || 'info'"
          size="small"
          effect="plain"
          class="chain-status"
        >
          {{ STATUS_MAP[n.status]?.label }}
        </el-tag>
        <span v-if="idx < pathChain.length - 1" class="chain-arrow">→</span>
      </div>
    </div>

    <!-- 解释文本 -->
    <div v-if="matchedPath?.explanation" class="explanation">
      <p>{{ matchedPath.explanation }}</p>
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
  background: var(--accent-bg, rgba(99, 102, 241, 0.1));
  border-radius: 6px;
  display: inline-block;
  margin-bottom: 14px;
}
.probability-badge strong {
  color: var(--accent, #6366f1);
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.option-card:hover {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);
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
  background: var(--accent, #6366f1);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.rank-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

.option-score {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent, #6366f1);
  margin-left: auto;
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

/* 路径链 */
.path-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--code-bg, #f5f5f5);
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
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 100px;
  transition: border-color 0.3s, background 0.3s;
}
.chain-card.positive,
.chain-card.success {
  border-color: #10b981;
  background: #f0fdf4;
}
.chain-card.negative,
.chain-card.error {
  border-color: #ef4444;
  background: #fef2f2;
}
.chain-card.warning {
  border-color: #f59e0b;
  background: #fffbeb;
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
  color: var(--accent, #6366f1);
}

.chain-status {
  font-size: 11px;
}

.chain-arrow {
  font-size: 14px;
  color: #cbd5e1;
  padding: 0 2px;
}

.explanation {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text, #555);
  border-top: 1px solid var(--border, #e5e4e7);
  padding-top: 12px;
  margin-top: 16px;
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
