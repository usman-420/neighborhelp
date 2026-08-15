<script setup>
// ProfileView.vue — your own account, skills and password.
import { ref, onMounted } from 'vue';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import StatCard from '../components/StatCard.vue';

const auth = useAuthStore();

const profile = ref(null);
const categories = ref([]);
const form = ref({ name: '', email: '', street: '', bio: '', skill_ids: [] });
const passwordForm = ref({ current_password: '', new_password: '', confirm: '' });

const errors = ref({});
const passwordErrors = ref({});
const loading = ref(true);
const saving = ref(false);
const savingPassword = ref(false);
const error = ref('');
const success = ref('');

function flash(message) {
  success.value = message;
  setTimeout(() => (success.value = ''), 3000);
}

onMounted(async () => {
  try {
    const [profileRes, catRes] = await Promise.all([api.get('/profile'), api.get('/categories')]);

    profile.value = profileRes.data;
    categories.value = catRes.data;

    form.value = {
      name: profileRes.data.name,
      email: profileRes.data.email,
      street: profileRes.data.street || '',
      bio: profileRes.data.bio || '',
      skill_ids: profileRes.data.skills.map((s) => s.id),
    };
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your profile';
  } finally {
    loading.value = false;
  }
});

function validate() {
  errors.value = {};

  if (!form.value.name.trim()) errors.value.name = 'Name is required';
  if (!form.value.email) errors.value.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
    errors.value.email = 'Enter a valid email address';
  if (form.value.bio.length > 255) errors.value.bio = 'Bio must be 255 characters or fewer';

  return Object.keys(errors.value).length === 0;
}

async function saveProfile() {
  error.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    const { data } = await api.put('/profile', form.value);
    // Keep the navbar name in sync with what was saved.
    auth.updateUser({ name: data.name, email: data.email });
    flash('Profile saved');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save your profile';
  } finally {
    saving.value = false;
  }
}

function validatePassword() {
  passwordErrors.value = {};

  if (!passwordForm.value.current_password)
    passwordErrors.value.current_password = 'Enter your current password';
  if (!passwordForm.value.new_password)
    passwordErrors.value.new_password = 'Enter a new password';
  else if (passwordForm.value.new_password.length < 6)
    passwordErrors.value.new_password = 'Must be at least 6 characters';
  if (passwordForm.value.new_password !== passwordForm.value.confirm)
    passwordErrors.value.confirm = 'Passwords do not match';

  return Object.keys(passwordErrors.value).length === 0;
}

async function changePassword() {
  error.value = '';
  if (!validatePassword()) return;

  savingPassword.value = true;
  try {
    await api.put('/profile/password', {
      current_password: passwordForm.value.current_password,
      new_password: passwordForm.value.new_password,
    });
    passwordForm.value = { current_password: '', new_password: '', confirm: '' };
    flash('Password changed');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not change your password';
  } finally {
    savingPassword.value = false;
  }
}

function toggleSkill(id) {
  const i = form.value.skill_ids.indexOf(id);
  if (i === -1) form.value.skill_ids.push(id);
  else form.value.skill_ids.splice(i, 1);
}
</script>

<template>
  <h1>Profile</h1>
  <p class="subtitle">Your details, and what you are happy to help with.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <p v-if="loading" class="loading">Loading…</p>

  <template v-else-if="profile">
    <div class="stats-grid">
      <StatCard label="Requests posted" :value="profile.stats.requests_posted" />
      <StatCard label="Helps given" :value="profile.stats.helps_given" />
      <!-- null, not 0.0, when there are no reviews — a 0.0 would read as a bad score -->
      <StatCard
        label="Your rating"
        :value="profile.stats.avg_rating === null ? '—' : profile.stats.avg_rating"
      />
      <StatCard label="Reviews received" :value="profile.stats.review_count" />
    </div>

    <div class="card">
      <h2>Your details</h2>

      <form novalidate @submit.prevent="saveProfile">
        <div class="form-row">
          <div class="field">
            <label for="name">Name</label>
            <input id="name" v-model="form.name" type="text" />
            <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
          </div>

          <div class="field">
            <label for="email">Email</label>
            <input id="email" v-model="form.email" type="email" />
            <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
          </div>
        </div>

        <div class="field">
          <label for="street">Street</label>
          <input id="street" v-model="form.street" type="text" placeholder="Bruul 12" />
          <p class="hint">Neighbours only ever see the street name, never the number.</p>
        </div>

        <div class="field">
          <label for="bio">About you</label>
          <textarea id="bio" v-model="form.bio" placeholder="A line about what you are happy to help with."></textarea>
          <p v-if="errors.bio" class="field-error">{{ errors.bio }}</p>
          <p class="hint">{{ form.bio.length }}/255</p>
        </div>

        <div class="field">
          <label>What can you help with?</label>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem">
            <button
              v-for="c in categories"
              :key="c.id"
              type="button"
              class="badge"
              :style="{
                cursor: 'pointer',
                border: 'none',
                background: form.skill_ids.includes(c.id) ? '#2563eb' : '#f3f4f6',
                color: form.skill_ids.includes(c.id) ? '#fff' : '#4b5563',
              }"
              @click="toggleSkill(c.id)"
            >
              {{ c.name }}
            </button>
          </div>
          <p class="hint">These decide which requests you get matched to.</p>
        </div>

        <p class="item-meta">
          Member since
          {{ new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }}
        </p>

        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save profile' }}
        </button>
      </form>
    </div>

    <div class="card">
      <h2>Change password</h2>

      <form novalidate @submit.prevent="changePassword">
        <div class="field">
          <label for="current">Current password</label>
          <input id="current" v-model="passwordForm.current_password" type="password" />
          <p v-if="passwordErrors.current_password" class="field-error">
            {{ passwordErrors.current_password }}
          </p>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="new">New password</label>
            <input id="new" v-model="passwordForm.new_password" type="password" />
            <p v-if="passwordErrors.new_password" class="field-error">
              {{ passwordErrors.new_password }}
            </p>
          </div>

          <div class="field">
            <label for="confirm">Confirm new password</label>
            <input id="confirm" v-model="passwordForm.confirm" type="password" />
            <p v-if="passwordErrors.confirm" class="field-error">{{ passwordErrors.confirm }}</p>
          </div>
        </div>

        <button type="submit" class="btn-secondary" :disabled="savingPassword">
          {{ savingPassword ? 'Changing…' : 'Change password' }}
        </button>
      </form>
    </div>
  </template>
</template>
