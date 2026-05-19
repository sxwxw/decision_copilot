<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function startNewDecision() {
  localStorage.removeItem('decision-copilot-state')
  router.push('/decision')
}

function openDemo() {
  router.push({ path: '/decision', query: { demo: 'mock' } })
}
</script>

<template>
  <div class="home-view">
    <!-- Header -->
    <header class="home-header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">◆</span>
          <span class="logo-text">Decision Copilot</span>
          <span class="logo-badge">BETA</span>
        </div>
      </div>
    </header>
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">让决策不再凭直觉</h1>
        <p class="hero-subtitle">
          基于多智能体分析、蒙特卡洛模拟与对抗性审查，为你的关键决策提供量化依据与风险洞察。
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="startNewDecision">
            开始推演
          </el-button>
          <el-button size="large" plain @click="openDemo">
            查看示例
          </el-button>
        </div>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value">4 步流水线</span>
            <span class="stat-label">框架构建 → 建模 → 模拟 → 综合分析</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">自我校准</span>
            <span class="stat-label">内循环修正模型偏差，外循环重塑框架</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">对抗性审查</span>
            <span class="stat-label">从框架偏见、模型失真、仿真假设多角度质疑</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <div class="footer-inner">
        <p>Decision Copilot — 基于结构化分析与蒙特卡洛模拟的决策辅助系统</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg, #fff);
}

/* ── Header ── */
.home-header {
  border-bottom: 1px solid var(--border, #e5e7eb);
  padding: 0 32px;
  background: var(--bg, #fff);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
  color: var(--accent, #3b82f6);
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h, #111827);
}

.logo-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-bg, rgba(59, 130, 246, 0.08));
  color: var(--accent, #3b82f6);
  border: 1px solid var(--accent-border, rgba(59, 130, 246, 0.3));
  font-weight: 600;
  letter-spacing: 0.5px;
}

.header-nav {
  display: none;
}

/* ── Hero ── */
.hero {
  padding: 80px 32px 64px;
  text-align: center;
}

.hero-content {
  max-width: 720px;
  margin: 0 auto;
}

.hero-title {
  font-size: 40px;
  font-weight: 800;
  color: var(--text-h, #111827);
  margin: 0 0 16px;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 17px;
  color: var(--text, #6b7280);
  line-height: 1.7;
  margin: 0 0 32px;
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
}

.hero-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent, #3b82f6);
}

.stat-label {
  font-size: 13px;
  color: var(--text, #6b7280);
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border, #e5e7eb);
  margin: 0 32px;
}

/* ── Footer ── */
.home-footer {
  border-top: 1px solid var(--border, #e5e7eb);
  padding: 24px 32px;
  margin-top: auto;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.footer-inner p {
  font-size: 13px;
  color: var(--text, #9ca3af);
  margin: 0;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .hero {
    padding: 48px 20px 40px;
  }
  .hero-title {
    font-size: 28px;
  }
  .hero-subtitle {
    font-size: 15px;
  }
  .hero-actions {
    flex-direction: column;
  }
  .header-nav {
    display: none;
  }
}
</style>
