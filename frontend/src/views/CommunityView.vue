<script setup>
// CommunityView.vue — open requests you can help with, plus the neighbour list.
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import RequestCard from '../components/RequestCard.vue';
import StarRating from '../components/StarRating.vue';

const auth = useAuthStore();

const tab = ref('requests');
const requests = ref([]);
const users = ref([]);
const categories = ref([]);
const myOfferIds = ref(new Set());

const categoryFilter = ref('');
const urgencyFilter = ref('');
const search = ref('');

const loading = ref(true);
const error = ref('');
const success = ref('');

// Offer dialog state
const offeringOn = ref(null);
const offerMessage = ref('');
const sendingOffer = ref(false);

function flash(message) {
  success.value = message;
  setTimeout(() => (success.value = ''), 3000);
}

// computed = derived value that recalculates when its inputs change.
const visibleRequests = computed(() =>
  requests.value.filter((r) => {
    if (r.user_id === auth.user.id) return false; // not my own
    if (categoryFilter.value && r.category_id !== Number(categoryFilter.value)) return false;
    if (urgencyFilter.value && r.urgency !== urgencyFilter.value) return false;
    return true;
  })
);

const visibleUsers = computed(() =>
  users.value.filter((u) => {
    if (search.value && !u.name.toLowerCase().includes(search.value.toLowerCase())) return false;
    if (categoryFilter.value) {
      const cat = categories.value.find((c) => c.id === Number(categoryFilter.value));
      if (cat && !u.skills.includes(cat.name)) return false;
    }
    return true;
  })
);

function initials(name) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

async function loadAll() {
  try {
    const [reqRes, userRes, catRes, offerRes] = await Promise.all([
      api.get('/requests'),
      api.get('/users'),
      api.get('/categories'),
      api.get('/offers?role=helper'),
    ]);
    requests.value = reqRes.data;
    users.value = userRes.data;
    categories.value = catRes.data;
    myOfferIds.value = new Set(offerRes.data.map((o) => o.request_id));
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load the community';
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);

function openOffer(request) {
  offeringOn.value = request;
  offerMessage.value = '';
}

async function sendOffer() {
  error.value = '';
  sendingOffer.value = true;

  try {
    await api.post('/offers', {
      request_id: offeringOn.value.id,
      message: offerMessage.value || null,
    });
    myOfferIds.value.add(offeringOn.value.id);
    offeringOn.value = null;
    flash('Offer sent — they will see it straight away');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not send your offer';
  } finally {
    sendingOffer.value = false;
  }
}
</script>

<template>
  <h1>Community</h1>
  <p class="subtitle">Neighbours asking for help, and the people ready to give it.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <div class="tabs">
    <button class="tab" :class="{ active: tab === 'requests' }" @click="tab = 'requests'">
      Open requests
    </button>
    <button class="tab" :class="{ active: tab === 'people' }" @click="tab = 'people'">
      People ready to help
    </button>
  </div>

  <div class="filters">
    <select v-model="categoryFilter" aria-label="Filter by category">
      <option value="">All categories</option>
      <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
    </select>

    <select v-if="tab === 'requests'" v-model="urgencyFilter" aria-label="Filter by urgency">
      <option value="">Any urgency</option>
      <option value="high">Urgent</option>
      <option value="normal">Normal</option>
      <option value="low">Low</option>
    </select>

    <input v-if="tab === 'people'" v-model="search" type="search" placeholder="Search by name" />
  </div>

  <p v-if="loading" class="loading">Loading…</p>

  <!-- Open requests -------------------------------------------------------->
  <div v-else-if="tab === 'requests'" class="card">
    <h2>{{ visibleRequests.length }} open request{{ visibleRequests.length === 1 ? '' : 's' }}</h2>

    <div v-if="visibleRequests.length === 0" class="empty">
      Nothing matches those filters right now.
    </div>

    <RequestCard v-for="r in visibleRequests" :key="r.id" :request="r">
      <template #actions>
        <button
          v-if="myOfferIds.has(r.id)"
          class="btn-secondary btn-small"
          disabled
        >
          Offer sent
        </button>
        <button v-else class="btn-primary btn-small" @click="openOffer(r)">
          Offer to help
        </button>
      </template>
    </RequestCard>
  </div>

  <!-- People --------------------------------------------------------------->
  <div v-else class="card">
    <h2>{{ visibleUsers.length }} neighbour{{ visibleUsers.length === 1 ? '' : 's' }}</h2>

    <div v-if="visibleUsers.length === 0" class="empty">No one matches that search.</div>

    <div class="user-grid">
      <div v-for="u in visibleUsers" :key="u.id" class="user-card">
        <div class="avatar">{{ initials(u.name) }}</div>

        <div style="flex: 1; min-width: 0">
          <div class="item-title">
            {{ u.name }}
            <span v-if="u.is_me" class="badge">you</span>
          </div>

          <div class="item-meta">
            <!-- Street name only. Never the house number. -->
            {{ u.street || 'Mechelen' }}
            <template v-if="u.distance_km !== null && !u.is_me"> · {{ u.distance_km }} km away</template>
          </div>

          <div class="item-meta" style="margin-top: 0.25rem">
            <StarRating v-if="u.review_count > 0" :model-value="u.avg_rating" :count="u.review_count" />
            <span v-else>No reviews yet</span>
            · {{ u.helps_given }} help{{ u.helps_given === 1 ? '' : 's' }} given
          </div>

          <div v-if="u.bio" class="item-body">{{ u.bio }}</div>

          <div style="margin-top: 0.5rem">
            <span v-for="s in u.skills" :key="s" class="badge">{{ s }}</span>
            <span v-if="u.skills.length === 0" class="item-meta">No skills listed yet</span>
          </div>
        </div>
      </div>
    </div>

    <p class="hint" style="margin-top: 1rem">
      Neighbours are shown by street name only. Exact addresses are never published, and map
      positions are approximate.
    </p>
  </div>

  <!-- Offer dialog ---------------------------------------------------------->
  <div v-if="offeringOn" class="card" style="border-color: #2563eb">
    <h2>Offer to help with "{{ offeringOn.title }}"</h2>

    <div class="field">
      <label for="offer-msg">Message (optional)</label>
      <textarea
        id="offer-msg"
        v-model="offerMessage"
        placeholder="When you are free, and anything useful you can bring."
      ></textarea>
      <p class="hint">{{ offerMessage.length }}/500</p>
    </div>

    <div class="btn-row">
      <button class="btn-primary" :disabled="sendingOffer" @click="sendOffer">
        {{ sendingOffer ? 'Sending…' : 'Send offer' }}
      </button>
      <button class="btn-secondary" @click="offeringOn = null">Cancel</button>
    </div>
  </div>
</template>
