<script setup>
// MyRequestsView.vue — "overview of user actions" + the full CRUD screen.
//
// Three tabs: my requests (create/read/update/delete), offers people
// made on them (accept/decline), and offers I made to others.
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import RequestForm from '../components/RequestForm.vue';
import RequestCard from '../components/RequestCard.vue';

const tab = ref('requests');

const requests = ref([]);
const offersOnMine = ref([]);
const myOffers = ref([]);

const editing = ref(null);
const formRef = ref(null);
const saving = ref(false);
const loading = ref(true);
const error = ref('');
const success = ref('');

const pendingCount = computed(
  () => offersOnMine.value.filter((o) => o.status === 'pending').length
);

function flash(message) {
  success.value = message;
  setTimeout(() => (success.value = ''), 3000);
}

async function loadAll() {
  try {
    const [mine, onMine, made] = await Promise.all([
      api.get('/requests?mine=true'),
      api.get('/offers?role=owner'),
      api.get('/offers?role=helper'),
    ]);
    requests.value = mine.data;
    offersOnMine.value = onMine.data;
    myOffers.value = made.data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your requests';
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);

// CREATE + UPDATE ----------------------------------------------------------
async function handleSave(formData) {
  error.value = '';
  saving.value = true;

  try {
    if (editing.value) {
      const { data } = await api.put(`/requests/${editing.value.id}`, formData);
      const i = requests.value.findIndex((r) => r.id === data.id);
      if (i !== -1) requests.value[i] = data;
      editing.value = null;
      flash('Request updated');
    } else {
      const { data } = await api.post('/requests', formData);
      requests.value.unshift(data);
      formRef.value.resetForm();
      flash('Request posted');
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save the request';
  } finally {
    saving.value = false;
  }
}

function startEdit(request) {
  editing.value = request;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// DELETE -------------------------------------------------------------------
async function handleDelete(request) {
  if (!window.confirm(`Delete "${request.title}"?`)) return;

  try {
    await api.delete(`/requests/${request.id}`);
    requests.value = requests.value.filter((r) => r.id !== request.id);
    if (editing.value?.id === request.id) editing.value = null;
    flash('Request deleted');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not delete the request';
  }
}

// Mark a matched request as done, which unlocks reviewing.
async function markComplete(request) {
  try {
    const { data } = await api.put(`/requests/${request.id}`, {
      title: request.title,
      description: request.description,
      category_id: request.category_id,
      urgency: request.urgency,
      street: request.street,
      needed_by: request.needed_by,
      status: 'completed',
    });
    const i = requests.value.findIndex((r) => r.id === data.id);
    if (i !== -1) requests.value[i] = data;
    flash('Marked as completed — you can now leave a review');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not update the request';
  }
}

// Accept / decline an offer someone made on my request ---------------------
async function respondToOffer(offer, status) {
  try {
    await api.put(`/offers/${offer.id}`, { status });
    await loadAll();
    flash(status === 'accepted' ? 'Offer accepted' : 'Offer declined');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not update the offer';
  }
}

// Withdraw an offer I made -------------------------------------------------
async function withdrawOffer(offer) {
  if (!window.confirm('Withdraw your offer?')) return;

  try {
    await api.delete(`/offers/${offer.id}`);
    myOffers.value = myOffers.value.filter((o) => o.id !== offer.id);
    flash('Offer withdrawn');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not withdraw the offer';
  }
}
</script>

<template>
  <h1>My requests</h1>
  <p class="subtitle">Everything you have asked for, and every offer you have made or received.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <div class="tabs">
    <button class="tab" :class="{ active: tab === 'requests' }" @click="tab = 'requests'">
      My requests ({{ requests.length }})
    </button>
    <button class="tab" :class="{ active: tab === 'received' }" @click="tab = 'received'">
      Offers received<template v-if="pendingCount"> ({{ pendingCount }} new)</template>
    </button>
    <button class="tab" :class="{ active: tab === 'made' }" @click="tab = 'made'">
      Offers I made ({{ myOffers.length }})
    </button>
  </div>

  <p v-if="loading" class="loading">Loading…</p>

  <!-- TAB: my requests ---------------------------------------------------->
  <template v-else-if="tab === 'requests'">
    <RequestForm
      ref="formRef"
      :request="editing"
      :saving="saving"
      @save="handleSave"
      @cancel="editing = null"
    />

    <div class="card">
      <h2>Your requests ({{ requests.length }})</h2>

      <div v-if="requests.length === 0" class="empty">
        You have not asked for anything yet. Use the form above.
      </div>

      <RequestCard v-for="r in requests" :key="r.id" :request="r">
        <template #actions>
          <button
            v-if="r.status === 'matched'"
            class="btn-success btn-small"
            @click="markComplete(r)"
          >
            Mark done
          </button>
          <button class="btn-secondary btn-small" @click="startEdit(r)">Edit</button>
          <button class="btn-danger btn-small" @click="handleDelete(r)">Delete</button>
        </template>
      </RequestCard>
    </div>
  </template>

  <!-- TAB: offers received ------------------------------------------------->
  <div v-else-if="tab === 'received'" class="card">
    <h2>Offers on your requests</h2>

    <div v-if="offersOnMine.length === 0" class="empty">
      No one has offered to help yet. Requests with a clear description tend to get answers faster.
    </div>

    <div v-for="offer in offersOnMine" :key="offer.id" class="item">
      <div class="item-head">
        <div>
          <div class="item-title">{{ offer.helper_name }}</div>
          <div class="item-meta">
            on "{{ offer.request_title }}"
            <span class="badge" :class="'badge-' + offer.status">{{ offer.status }}</span>
          </div>
        </div>

        <div class="item-actions">
          <template v-if="offer.status === 'pending'">
            <button class="btn-success btn-small" @click="respondToOffer(offer, 'accepted')">
              Accept
            </button>
            <button class="btn-secondary btn-small" @click="respondToOffer(offer, 'declined')">
              Decline
            </button>
          </template>
        </div>
      </div>

      <div v-if="offer.message" class="item-body">{{ offer.message }}</div>
    </div>
  </div>

  <!-- TAB: offers I made --------------------------------------------------->
  <div v-else class="card">
    <h2>Offers you have made</h2>

    <div v-if="myOffers.length === 0" class="empty">
      You have not offered to help anyone yet. Have a look at the Community tab.
    </div>

    <div v-for="offer in myOffers" :key="offer.id" class="item">
      <div class="item-head">
        <div>
          <div class="item-title">{{ offer.request_title }}</div>
          <div class="item-meta">
            asked by {{ offer.owner_name }}
            <span class="badge" :class="'badge-' + offer.status">{{ offer.status }}</span>
          </div>
        </div>

        <div class="item-actions">
          <button
            v-if="offer.status === 'pending'"
            class="btn-secondary btn-small"
            @click="withdrawOffer(offer)"
          >
            Withdraw
          </button>
        </div>
      </div>

      <div v-if="offer.message" class="item-body">{{ offer.message }}</div>
    </div>
  </div>
</template>
