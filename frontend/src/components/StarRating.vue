<script setup>
// StarRating.vue — shows stars, or lets the user pick when editable.
//
// When editable it works with v-model: the parent writes
// <StarRating v-model="rating" editable /> and this component emits
// 'update:modelValue', which is what v-model listens for.
defineProps({
  modelValue: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
  count: { type: Number, default: null }, // number of reviews, shown in brackets
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div v-if="editable" class="star-input">
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      class="star-btn"
      :class="{ on: n <= modelValue }"
      :aria-label="`${n} star${n === 1 ? '' : 's'}`"
      @click="emit('update:modelValue', n)"
    >
      ★
    </button>
  </div>

  <span v-else class="item-meta">
    <span class="stars">{{ '★'.repeat(Math.round(modelValue)) }}{{ '☆'.repeat(5 - Math.round(modelValue)) }}</span>
    <template v-if="modelValue"> {{ Number(modelValue).toFixed(1) }}</template>
    <template v-if="count !== null"> ({{ count }})</template>
  </span>
</template>
