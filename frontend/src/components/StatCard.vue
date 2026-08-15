<script setup>
// StatCard.vue — one number with a label. Used across several pages.
defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  unit: { type: String, default: '' },
});
</script>

<template>
  <div class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value">
      {{ value }}<span v-if="unit" class="stat-unit"> {{ unit }}</span>
    </div>
  </div>
</template>
