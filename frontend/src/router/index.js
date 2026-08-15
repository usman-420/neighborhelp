// router/index.js — URL to view mapping, plus the navigation guard.

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/', redirect: '/dashboard' },

  { path: '/login',    component: () => import('../views/LoginView.vue'),    meta: { guestOnly: true } },
  { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { guestOnly: true } },

  { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
  { path: '/find-help', component: () => import('../views/FindHelpView.vue'),  meta: { requiresAuth: true } },
  { path: '/requests',  component: () => import('../views/MyRequestsView.vue'), meta: { requiresAuth: true } },
  { path: '/community', component: () => import('../views/CommunityView.vue'), meta: { requiresAuth: true } },
  { path: '/map',       component: () => import('../views/MapView.vue'),       meta: { requiresAuth: true } },
  { path: '/reviews',   component: () => import('../views/ReviewsView.vue'),   meta: { requiresAuth: true } },
  { path: '/report',    component: () => import('../views/ReportView.vue'),    meta: { requiresAuth: true } },
  { path: '/privacy',   component: () => import('../views/PrivacyView.vue'),   meta: { requiresAuth: true } },
  { path: '/profile',   component: () => import('../views/ProfileView.vue'),   meta: { requiresAuth: true } },

  // Admin-only
  { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },

  { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Runs before every navigation — the frontend equivalent of the
// backend's auth middleware. This is UX only: the real protection is
// server-side, because anyone can edit their own JavaScript.
router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login';
  if (to.meta.requiresAdmin && !auth.isAdmin) return '/dashboard';
  if (to.meta.guestOnly && auth.isLoggedIn) return '/dashboard';

  return true;
});

export default router;
