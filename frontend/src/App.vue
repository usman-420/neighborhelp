<script setup>
// App.vue — the shell: navbar when logged in, then the matched page.
import { useAuthStore } from './stores/auth';
import NavBar from './components/NavBar.vue';

const auth = useAuthStore();
</script>

<template>
  <NavBar v-if="auth.isLoggedIn" />

  <main :class="auth.isLoggedIn ? 'container' : ''">
    <RouterView />
  </main>
</template>
