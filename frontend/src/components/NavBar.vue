<script setup>
// NavBar.vue — navigation and logout.
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <header class="navbar">
    <div class="navbar-inner">
      <span class="logo">NeighborHelp</span>

      <nav class="nav-links">
        <RouterLink to="/dashboard">Home</RouterLink>
        <RouterLink to="/find-help">Find Help</RouterLink>
        <RouterLink to="/requests">My Requests</RouterLink>
        <RouterLink to="/community">Community</RouterLink>
        <RouterLink to="/map">Map</RouterLink>
        <RouterLink to="/reviews">Reviews</RouterLink>
        <RouterLink to="/report">Report</RouterLink>
        <RouterLink to="/privacy">Privacy</RouterLink>
        <RouterLink to="/profile">Profile</RouterLink>
        <!-- Only admins ever see this link -->
        <RouterLink v-if="auth.isAdmin" to="/admin">Admin</RouterLink>
      </nav>

      <div class="nav-right">
        <span class="nav-user">
          {{ auth.user?.name }}
          <span v-if="auth.isAdmin" class="admin-tag">admin</span>
        </span>

        <button class="btn-secondary btn-small" @click="handleLogout">Logout</button>
      </div>
    </div>
  </header>
</template>
