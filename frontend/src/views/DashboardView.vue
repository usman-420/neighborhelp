<script setup>
// DashboardView.vue — the Home tab.
import { ref, onMounted } from 'vue';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import StatCard from '../components/StatCard.vue';
import RequestCard from '../components/RequestCard.vue';

const auth = useAuthStore();

const stats = ref(null);
const openRequests = ref([]);
const myOffers = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    // Fetch in parallel rather than one after another.
    const [statsRes, requestsRes, offersRes] = await Promise.all([
      api.get('/requests/stats'),
      api.get('/requests'),
      api.get('/offers?role=owner'),
    ]);

    stats.value = statsRes.data;
    // Other people's open requests — not my own.
    openRequests.value = requestsRes.data
      .filter((r) => r.user_id !== auth.user.id)
      .slice(0, 4);
    myOffers.value = offersRes.data.filter((o) => o.status === 'pending').slice(0, 3);
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your dashboard';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h1>Hello, {{ auth.user?.name }}</h1>
  <p class="subtitle">What is happening in Mechelen today.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <p v-if="loading" class="loading">Loading…</p>

  <template v-else-if="stats">
    <div class="stats-grid">
      <StatCard label="Your requests" :value="stats.my_requests" />
      <StatCard label="You're helping with" :value="stats.helping_with" />
      <StatCard label="Open in your area" :value="stats.open_requests" />
      <StatCard label="Neighbours" :value="stats.active_users" />
    </div>

    <!-- Offers waiting on my own requests -->
    <div v-if="myOffers.length > 0" class="card">
      <h2>Offers waiting for your answer</h2>
      <div v-for="offer in myOffers" :key="offer.id" class="item">
        <div class="item-title">{{ offer.helper_name }} offered to help</div>
        <div class="item-meta">on "{{ offer.request_title }}"</div>
        <div v-if="offer.message" class="item-body">{{ offer.message }}</div>
      </div>
      <RouterLink to="/requests">
        <button class="btn-secondary btn-small">Review all offers</button>
      </RouterLink>
    </div>

    <div class="card">
      <h2>Neighbours who need a hand</h2>

      <div v-if="openRequests.length === 0" class="empty">
        No open requests right now. Quiet week in the neighbourhood.
      </div>

      <RequestCard v-for="r in openRequests" :key="r.id" :request="r" />

      <RouterLink to="/community">
        <button class="btn-secondary btn-small">See all requests</button>
      </RouterLink>
    </div>

    <div class="card">
      <h2>Need something yourself?</h2>
      <p class="subtitle" style="margin-bottom: 1rem">
        Post a request and we will suggest the neighbours best placed to help.
      </p>
      <RouterLink to="/find-help">
        <button class="btn-primary">Ask for help</button>
      </RouterLink>
    </div>
  </template>
</template>
