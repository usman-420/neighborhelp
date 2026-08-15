<script setup>
// FindHelpView.vue — post a request, then see ranked helper matches.
//
// This is the screen that carries the product's main claim, so the
// matching is shown WITH its reasons rather than as a mystery number.
import { ref } from 'vue';
import api from '../services/api';
import RequestForm from '../components/RequestForm.vue';
import StarRating from '../components/StarRating.vue';

const formRef = ref(null);
const saving = ref(false);
const error = ref('');
const success = ref('');

const created = ref(null);   // the request we just posted
const matches = ref([]);
const loadingMatches = ref(false);

function scoreClass(score) {
  if (score >= 75) return 'score-strong';
  if (score >= 50) return 'score-mid';
  return 'score-weak';
}

async function handleSave(formData) {
  error.value = '';
  success.value = '';
  saving.value = true;

  try {
    const { data } = await api.post('/requests', formData);
    created.value = data;
    formRef.value.resetForm();
    success.value = 'Your request is live. Here are the neighbours best placed to help.';

    loadingMatches.value = true;
    const res = await api.get(`/requests/${data.id}/matches`);
    matches.value = res.data.matches;
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not post your request';
  } finally {
    saving.value = false;
    loadingMatches.value = false;
  }
}
</script>

<template>
  <h1>Find help</h1>
  <p class="subtitle">
    Describe what you need. We rank neighbours by skill, distance, rating and how busy they are —
    and show you exactly why each one was suggested.
  </p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <RequestForm ref="formRef" :saving="saving" @save="handleSave" />

  <div v-if="created" class="card">
    <h2>Suggested helpers for "{{ created.title }}"</h2>

    <p v-if="loadingMatches" class="loading">Finding neighbours…</p>

    <div v-else-if="matches.length === 0" class="empty">
      No neighbours found nearby yet. Your request is still visible to everyone in the Community tab.
    </div>

    <div v-else>
      <div v-for="m in matches" :key="m.id" class="match">
        <div class="score-ring" :class="scoreClass(m.score)">
          {{ m.score }}
          <small>/100</small>
        </div>

        <div style="flex: 1">
          <div class="item-title">{{ m.name }}</div>
          <div class="item-meta">
            {{ m.street || 'Mechelen' }}
            <template v-if="m.review_count > 0">
              ·
              <StarRating :model-value="m.avg_rating" :count="m.review_count" />
            </template>
          </div>

          <!-- The transparency that makes this defensible -->
          <ul class="reasons">
            <li v-for="(reason, i) in m.reasons" :key="i">{{ reason }}</li>
          </ul>
        </div>
      </div>

      <p class="hint">
        Scores are a weighted total: skill match 40, distance 25, rating 20, availability 15.
        Nothing is hidden — the same four numbers produce every ranking.
      </p>
    </div>
  </div>
</template>
