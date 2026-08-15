<script setup>
// ReportView.vue — an actual reporting form.
//
// In the original prototype this tab only said "go to someone's profile
// to report them", which made a whole nav item a dead end. Here the
// form lives on the page it is named after.
import { ref, onMounted } from 'vue';
import api from '../services/api';

const users = ref([]);
const reasons = ref([]);
const myReports = ref([]);

const form = ref({ reported_user_id: '', reason: '', details: '' });
const errors = ref({});

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref('');

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadAll() {
  try {
    const [userRes, reasonRes, reportRes] = await Promise.all([
      api.get('/users'),
      api.get('/reports/reasons'),
      api.get('/reports'),
    ]);
    users.value = userRes.data.filter((u) => !u.is_me);
    reasons.value = reasonRes.data;
    myReports.value = reportRes.data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load the report form';
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);

function validate() {
  errors.value = {};

  if (!form.value.reported_user_id) errors.value.reported_user_id = 'Please choose who you are reporting';
  if (!form.value.reason) errors.value.reason = 'Please choose a reason';
  if (form.value.details.length > 500) errors.value.details = 'Details must be 500 characters or fewer';

  return Object.keys(errors.value).length === 0;
}

async function submitReport() {
  error.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    await api.post('/reports', {
      reported_user_id: form.value.reported_user_id,
      reason: form.value.reason,
      details: form.value.details || null,
    });

    form.value = { reported_user_id: '', reason: '', details: '' };
    success.value = 'Report submitted. An administrator will look at it.';
    setTimeout(() => (success.value = ''), 4000);

    await loadAll();
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not submit your report';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <h1>Report a problem</h1>
  <p class="subtitle">
    If someone behaved badly or something felt unsafe, tell us here. Reports go only to
    administrators, never to the person you are reporting.
  </p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <p v-if="loading" class="loading">Loading…</p>

  <template v-else>
    <div class="card">
      <h2>New report</h2>

      <form novalidate @submit.prevent="submitReport">
        <div class="field">
          <label for="who">Who are you reporting?</label>
          <select id="who" v-model="form.reported_user_id">
            <option value="" disabled>Choose a neighbour…</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
          <p v-if="errors.reported_user_id" class="field-error">{{ errors.reported_user_id }}</p>
        </div>

        <div class="field">
          <label for="reason">Reason</label>
          <select id="reason" v-model="form.reason">
            <option value="" disabled>Choose a reason…</option>
            <option v-for="r in reasons" :key="r" :value="r">{{ r }}</option>
          </select>
          <p v-if="errors.reason" class="field-error">{{ errors.reason }}</p>
        </div>

        <div class="field">
          <label for="details">What happened? (optional)</label>
          <textarea id="details" v-model="form.details" placeholder="Dates, what was agreed, what went wrong."></textarea>
          <p v-if="errors.details" class="field-error">{{ errors.details }}</p>
          <p class="hint">{{ form.details.length }}/500</p>
        </div>

        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Submitting…' : 'Submit report' }}
        </button>
      </form>
    </div>

    <div class="card">
      <h2>Your previous reports</h2>

      <div v-if="myReports.length === 0" class="empty">
        You have not reported anyone. That is a good sign.
      </div>

      <div v-for="r in myReports" :key="r.id" class="item">
        <div class="item-head">
          <div>
            <div class="item-title">{{ r.reason }}</div>
            <div class="item-meta">
              about {{ r.reported_user_name }} · {{ formatDate(r.created_at) }}
              <span class="badge" :class="'badge-' + r.status">{{ r.status }}</span>
            </div>
          </div>
        </div>
        <div v-if="r.details" class="item-body">{{ r.details }}</div>
      </div>
    </div>
  </template>
</template>
