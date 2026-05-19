import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DecisionView from '../views/DecisionView.vue'

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/decision', name: 'Decision', component: DecisionView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
