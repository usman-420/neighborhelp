<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const form = ref({ name: '', email: '', street: '', password: '', confirm: '' });
const errors = ref({});
const serverError = ref('');
const loading = ref(false);

function validate() {
  errors.value = {};

  if (!form.value.name.trim()) errors.value.name = 'Name is required';
  else if (form.value.name.trim().length < 2) errors.value.name = 'Please enter your full name';

  if (!form.value.email) errors.value.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
    errors.value.email = 'Enter a valid email address';

  if (!form.value.password) errors.value.password = 'Password is required';
  else if (form.value.password.length < 6)
    errors.value.password = 'Password must be at least 6 characters';

  if (form.value.password !== form.value.confirm)
    errors.value.confirm = 'Passwords do not match';

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  serverError.value = '';
  if (!validate()) return;

  loading.value = true;
  try {
    await auth.register({
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      street: form.value.street || null,
    });
    router.push('/dashboard');
  } catch (err) {
    serverError.value = err.response?.data?.message || 'Could not reach the server';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="card">
      <h1 class="auth-title">Join NeighborHelp</h1>
      <p class="auth-sub">Ask for a hand, or lend one</p>

      <div v-if="serverError" class="alert-error">{{ serverError }}</div>

      <form novalidate @submit.prevent="handleSubmit">
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" v-model="form.name" type="text" placeholder="Jan Janssens" />
          <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="form.email" type="email" placeholder="you@example.com" />
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <div class="field">
          <label for="street">Street (optional)</label>
          <input id="street" v-model="form.street" type="text" placeholder="Bruul 12" />
          <p class="hint">Used to find neighbours near you. Others only ever see the street name.</p>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="form.password" type="password" placeholder="At least 6 characters" />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" v-model="form.confirm" type="password" placeholder="Repeat password" />
          <p v-if="errors.confirm" class="field-error">{{ errors.confirm }}</p>
        </div>

        <button type="submit" class="btn-primary full-width" :disabled="loading">
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="auth-switch">
        Already a member? <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
