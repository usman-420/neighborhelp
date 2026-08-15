<script setup>
// MapView.vue — neighbours on a real OpenStreetMap map.
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import HelperMap from '../components/HelperMap.vue';

const users = ref([]);
const categories = ref([]);
const categoryFilter = ref('');
const loading = ref(true);
const error = ref('');

const visibleUsers = computed(() => {
  if (!categoryFilter.value) return users.value;
  const cat = categories.value.find((c) => c.id === Number(categoryFilter.value));
  if (!cat) return users.value;
  return users.value.filter((u) => u.skills.includes(cat.name));
});

const averageRating = computed(() => {
  const rated = users.value.filter((u) => u.avg_rating !== null);
  if (rated.length === 0) return null;
  const total = rated.reduce((sum, u) => sum + u.avg_rating, 0);
  return (total / rated.length).toFixed(1);
});

onMounted(async () => {
  try {
    const [userRes, catRes] = await Promise.all([api.get('/users'), api.get('/categories')]);
    users.value = userRes.data;
    categories.value = catRes.data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load the map';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h1>Map</h1>
  <p class="subtitle">Neighbours around Mechelen. Click a marker for details.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <p v-if="loading" class="loading">Loading map…</p>

  <template v-else>
    <div class="filters">
      <select v-model="categoryFilter" aria-label="Filter map by skill">
        <option value="">All skills</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>

    <div class="map-layout">
      <HelperMap :users="visibleUsers" />

      <div>
        <div class="card">
          <h3>Legend</h3>
          <!-- Colour AND the number in the marker, so the meaning does not
               depend on colour vision alone. -->
          <div class="legend-row">
            <span class="legend-dot" style="background: #059669"></span> 4.5+ excellent
          </div>
          <div class="legend-row">
            <span class="legend-dot" style="background: #d97706"></span> 3.5–4.4 good
          </div>
          <div class="legend-row">
            <span class="legend-dot" style="background: #dc2626"></span> below 3.5
          </div>
          <div class="legend-row">
            <span class="legend-dot" style="background: #9ca3af"></span> no reviews yet
          </div>
          <p class="hint">Each marker also shows the rating as a number.</p>
        </div>

        <div class="card">
          <h3>Quick stats</h3>
          <p class="item-meta">{{ visibleUsers.length }} neighbours shown</p>
          <p class="item-meta">
            Average rating:
            <template v-if="averageRating">{{ averageRating }}</template>
            <template v-else>no reviews yet</template>
          </p>
        </div>

        <div class="card">
          <h3>Privacy</h3>
          <p class="item-meta">
            Marker positions are deliberately approximate — roughly a 150 m circle around
            someone's street. Exact addresses are never sent to the browser.
          </p>
        </div>
      </div>
    </div>
  </template>
</template>
