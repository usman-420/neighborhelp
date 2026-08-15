<script setup>
// NotFoundView.vue — catch-all for unknown URLs.
</script>

<template>
  <div class="empty" style="padding-top: 4rem">
    <h1>Page not found</h1>
    <p class="subtitle">That address does not exist.</p>
    <RouterLink to="/dashboard">
      <button class="btn-primary">Back to home</button>
    </RouterLink>
  </div>
</template>
