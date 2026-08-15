<script setup>
// RequestCard.vue — one help request in a list.
// The parent decides which action buttons to show via slots.
import { computed } from 'vue';

const props = defineProps({
  request: { type: Object, required: true },
});

const urgencyLabel = { low: 'Low', normal: 'Normal', high: 'Urgent' };

const when = computed(() => {
  const days = Math.round((Date.now() - new Date(props.request.created_at)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
});

const neededBy = computed(() => {
  if (!props.request.needed_by) return null;
  return new Date(props.request.needed_by).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
});
</script>

<template>
  <div class="item">
    <div class="item-head">
      <div>
        <div class="item-title">{{ request.title }}</div>
        <div class="item-meta">
          <span class="badge">{{ request.category_name }}</span>
          <span class="badge" :class="'badge-' + request.urgency">
            {{ urgencyLabel[request.urgency] }}
          </span>
          <span class="badge" :class="'badge-' + request.status">{{ request.status }}</span>
        </div>
        <div class="item-meta" style="margin-top: 0.4rem">
          <template v-if="request.user_name">{{ request.user_name }} · </template>
          {{ request.street || 'Mechelen' }} · posted {{ when }}
          <template v-if="neededBy"> · needed by {{ neededBy }}</template>
          <template v-if="request.offer_count !== undefined">
            · {{ request.offer_count }} offer{{ Number(request.offer_count) === 1 ? '' : 's' }}
          </template>
        </div>
      </div>

      <div class="item-actions">
        <!-- Parent supplies buttons here -->
        <slot name="actions" />
      </div>
    </div>

    <div v-if="request.description" class="item-body">{{ request.description }}</div>

    <slot />
  </div>
</template>
