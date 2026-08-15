// stores/auth.js — the logged-in user and token, shared app-wide.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

export const useAuthStore = defineStore('auth', () => {
  // Read from localStorage so a refresh doesn't log the user out.
  const token = ref(localStorage.getItem('token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setSession(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }

  async function register(payload) {
    const { data } = await api.post('/auth/register', payload);
    setSession(data.token, data.user);
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data.token, data.user);
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  function updateUser(newUser) {
    user.value = { ...user.value, ...newUser };
    localStorage.setItem('user', JSON.stringify(user.value));
  }

  return { token, user, isLoggedIn, isAdmin, register, login, logout, updateUser };
});
