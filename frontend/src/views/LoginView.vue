<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const errors = ref({});
const serverError = ref('');
const loading = ref(false);

function validate() {
  errors.value = {};

  if (!email.value) errors.value.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
    errors.value.email = 'Enter a valid email address';

  if (!password.value) errors.value.password = 'Password is required';

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  serverError.value = '';
  if (!validate()) return;

  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/dashboard');
  } catch (err) {
    serverError.value = err.response?.data?.message || 'Could not reach the server';
  } finally {
    loading.value = false;
  }
}

function useDemo(demoEmail) {
  email.value = demoEmail;
  password.value = 'password123';
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="card">
      <h1 class="auth-title">NeighborHelp</h1>
      <p class="auth-sub">Connect with your Mechelen community</p>

      <div v-if="serverError" class="alert-error">{{ serverError }}</div>

      <form novalidate @submit.prevent="handleSubmit">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" />
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" placeholder="••••••••" />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <button type="submit" class="btn-primary full-width" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="auth-switch">
        New here? <RouterLink to="/register">Create an account</RouterLink>
      </p>

      <div class="demo-box">
        <strong>Demo accounts</strong> (password <code>password123</code>):<br />
        <a href="#" @click.prevent="useDemo('sarah@example.com')">sarah@example.com</a> — has requests and offers waiting<br />
        <a href="#" @click.prevent="useDemo('admin@neighborhelp.be')">admin@neighborhelp.be</a> — admin dashboard
      </div>
    </div>
  </div>
</template>
