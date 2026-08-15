<script setup>
// ReviewsView.vue — community reviews, plus leaving one.
//
// Note on the numbers: the stats, the top-rated list and the recent
// reviews all come from the SAME endpoint reading the SAME table, so
// they can never contradict each other.
import { ref, onMounted } from 'vue';
import api from '../services/api';
import StatCard from '../components/StatCard.vue';
import StarRating from '../components/StarRating.vue';

const stats = ref(null);
const topRated = ref([]);
const recent = ref([]);
const reviewable = ref([]);

const loading = ref(true);
const error = ref('');
const success = ref('');
const saving = ref(false);

// The "leave a review" form
const form = ref({ request_id: '', rating: 0, comment: '' });
const errors = ref({});

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function loadAll() {
  try {
    const [reviewRes, reviewableRes] = await Promise.all([
      api.get('/reviews'),
      api.get('/reviews/reviewable'),
    ]);

    stats.value = reviewRes.data.stats;
    topRated.value = reviewRes.data.top_rated;
    recent.value = reviewRes.data.recent;
    reviewable.value = reviewableRes.data;

    if (reviewable.value.length > 0) {
      form.value.request_id = reviewable.value[0].request_id;
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load reviews';
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);

function validate() {
  errors.value = {};

  if (!form.value.request_id) errors.value.request_id = 'Choose which help you are reviewing';
  if (!form.value.rating) errors.value.rating = 'Please choose a star rating';
  if (form.value.comment.length > 500) errors.value.comment = 'Comment must be 500 characters or fewer';

  return Object.keys(errors.value).length === 0;
}

async function submitReview() {
  error.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    await api.post('/reviews', {
      request_id: form.value.request_id,
      rating: form.value.rating,
      comment: form.value.comment || null,
    });

    form.value = { request_id: '', rating: 0, comment: '' };
    success.value = 'Thank you — your review is published';
    setTimeout(() => (success.value = ''), 3000);

    await loadAll(); // refresh so the new review and the totals both update
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save your review';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <h1>Reviews</h1>
  <p class="subtitle">How the community rates each other after helping out.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <p v-if="loading" class="loading">Loading…</p>

  <template v-else>
    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr)">
      <StatCard label="Total reviews" :value="stats.total_reviews" />
      <StatCard
        label="Average rating"
        :value="stats.total_reviews > 0 ? stats.average_rating : '—'"
      />
      <StatCard label="People reviewed" :value="stats.reviewed_users" />
    </div>

    <!-- Leave a review. Only shown when you actually have something to
         review, so the call to action is never a dead end. -->
    <div v-if="reviewable.length > 0" class="card">
      <h2>Leave a review</h2>

      <form novalidate @submit.prevent="submitReview">
        <div class="field">
          <label for="which">Which help?</label>
          <select id="which" v-model="form.request_id">
            <option v-for="r in reviewable" :key="r.request_id" :value="r.request_id">
              {{ r.title }} — with {{ r.other_user_name }}
            </option>
          </select>
          <p v-if="errors.request_id" class="field-error">{{ errors.request_id }}</p>
        </div>

        <div class="field">
          <label>Rating</label>
          <StarRating v-model="form.rating" editable />
          <p v-if="errors.rating" class="field-error">{{ errors.rating }}</p>
        </div>

        <div class="field">
          <label for="comment">Comment (optional)</label>
          <textarea id="comment" v-model="form.comment" placeholder="How did it go?"></textarea>
          <p v-if="errors.comment" class="field-error">{{ errors.comment }}</p>
        </div>

        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Publishing…' : 'Publish review' }}
        </button>
      </form>
    </div>

    <div v-else class="card">
      <h2>Leave a review</h2>
      <p class="item-meta">
        You can review someone once a request you were part of is marked completed.
        Mark one done in <RouterLink to="/requests">My requests</RouterLink>.
      </p>
    </div>

    <div class="card">
      <h2>Top rated neighbours</h2>

      <div v-if="topRated.length === 0" class="empty">
        No one has been rated yet. Be the first to leave a review.
      </div>

      <div v-for="u in topRated" :key="u.id" class="item">
        <div class="item-title">{{ u.name }}</div>
        <div class="item-meta">
          <StarRating :model-value="u.avg_rating" :count="u.review_count" />
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Recent reviews</h2>

      <div v-if="recent.length === 0" class="empty">
        No reviews yet. Once neighbours start helping each other they will appear here.
      </div>

      <div v-for="r in recent" :key="r.id" class="item">
        <div class="item-head">
          <div>
            <div class="item-title">
              {{ r.reviewer_name }} → {{ r.reviewee_name }}
            </div>
            <div class="item-meta">
              <StarRating :model-value="r.rating" />
              · {{ r.request_title }} · {{ formatDate(r.created_at) }}
            </div>
          </div>
        </div>

        <div v-if="r.comment" class="item-body">{{ r.comment }}</div>
      </div>
    </div>
  </template>
</template>
