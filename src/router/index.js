import { createRouter, createWebHistory } from 'vue-router'
import DecisionView from '../views/DecisionView.vue'

const routes = [
  { path: '/decision', name: 'Decision', component: DecisionView },
  { path: '/', redirect: '/decision' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
