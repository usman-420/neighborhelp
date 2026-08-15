<script setup>
// AdminView.vue — the business/owner dashboard.
//
// Categories are the "core resource" with full CRUD. Users and reports
// are moderation. The whole page is unreachable without an admin token:
// the router guard hides it, and the API rejects it with 403 regardless.
import { ref, onMounted } from 'vue';
import api from '../services/api';
import StatCard from '../components/StatCard.vue';

const tab = ref('categories');

const stats = ref(null);
const categories = ref([]);
const users = ref([]);
const reports = ref([]);

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref('');

// Category form — doubles as create and edit.
const editing = ref(null);
const form = ref({ name: '', description: '', is_active: true });
const errors = ref({});

function flash(message) {
  success.value = message;
  setTimeout(() => (success.value = ''), 3000);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadAll() {
  try {
    const [statsRes, catRes, userRes, reportRes] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/categories'),
      api.get('/admin/users'),
      api.get('/admin/reports'),
    ]);
    stats.value = statsRes.data;
    categories.value = catRes.data;
    users.value = userRes.data;
    reports.value = reportRes.data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load the admin dashboard';
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);

// --- Categories: CRUD ------------------------------------------------------
function validate() {
  errors.value = {};

  if (!form.value.name.trim()) errors.value.name = 'Name is required';
  else if (form.value.name.length > 50) errors.value.name = 'Name must be 50 characters or fewer';

  return Object.keys(errors.value).length === 0;
}

async function saveCategory() {
  error.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    if (editing.value) {
      const { data } = await api.put(`/admin/categories/${editing.value.id}`, form.value);
      const i = categories.value.findIndex((c) => c.id === data.id);
      if (i !== -1) categories.value[i] = { ...data, request_count: categories.value[i].request_count };
      editing.value = null;
      flash('Category updated');
    } else {
      const { data } = await api.post('/admin/categories', form.value);
      categories.value.push(data);
      flash('Category created');
    }
    form.value = { name: '', description: '', is_active: true };
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save the category';
  } finally {
    saving.value = false;
  }
}

function startEdit(category) {
  editing.value = category;
  form.value = {
    name: category.name,
    description: category.description || '',
    is_active: !!category.is_active,
  };
  errors.value = {};
}

function cancelEdit() {
  editing.value = null;
  form.value = { name: '', description: '', is_active: true };
  errors.value = {};
}

async function deleteCategory(category) {
  if (!window.confirm(`Delete "${category.name}"?`)) return;

  error.value = '';
  try {
    await api.delete(`/admin/categories/${category.id}`);
    categories.value = categories.value.filter((c) => c.id !== category.id);
    flash('Category deleted');
  } catch (err) {
    // The API refuses to delete a category still in use and says so.
    error.value = err.response?.data?.message || 'Could not delete the category';
  }
}

// --- Users -----------------------------------------------------------------
async function toggleUser(user) {
  error.value = '';
  try {
    await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
    user.is_active = !user.is_active;
    flash(user.is_active ? 'User activated' : 'User deactivated');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not update the user';
  }
}

// --- Reports ---------------------------------------------------------------
async function setReportStatus(report, status) {
  error.value = '';
  try {
    await api.put(`/admin/reports/${report.id}`, { status });
    report.status = status;
    flash('Report updated');
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not update the report';
  }
}
</script>

<template>
  <h1>Admin dashboard</h1>
  <p class="subtitle">Manage categories, moderate members, and handle reports.</p>

  <div v-if="error" class="alert-error">{{ error }}</div>
  <div v-if="success" class="alert-success">{{ success }}</div>

  <p v-if="loading" class="loading">Loading…</p>

  <template v-else>
    <div class="stats-grid">
      <StatCard label="Members" :value="stats.total_users" />
      <StatCard label="Requests" :value="stats.total_requests" />
      <StatCard label="Open requests" :value="stats.open_requests" />
      <StatCard label="Open reports" :value="stats.open_reports" />
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'categories' }" @click="tab = 'categories'">
        Categories ({{ categories.length }})
      </button>
      <button class="tab" :class="{ active: tab === 'users' }" @click="tab = 'users'">
        Members ({{ users.length }})
      </button>
      <button class="tab" :class="{ active: tab === 'reports' }" @click="tab = 'reports'">
        Reports ({{ reports.length }})
      </button>
    </div>

    <!-- CATEGORIES: the CRUD resource -------------------------------------->
    <template v-if="tab === 'categories'">
      <div class="card">
        <h2>{{ editing ? 'Edit category' : 'New category' }}</h2>

        <form novalidate @submit.prevent="saveCategory">
          <div class="form-row">
            <div class="field">
              <label for="cat-name">Name</label>
              <input id="cat-name" v-model="form.name" type="text" placeholder="e.g. Bike repairs" />
              <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
            </div>

            <div class="field">
              <label for="cat-active">Status</label>
              <select id="cat-active" v-model="form.is_active">
                <option :value="true">Active</option>
                <option :value="false">Hidden</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label for="cat-desc">Description</label>
            <input id="cat-desc" v-model="form.description" type="text" placeholder="What kind of help this covers" />
          </div>

          <div class="btn-row">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Create category' }}
            </button>
            <button v-if="editing" type="button" class="btn-secondary" @click="cancelEdit">
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>All categories</h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Description</th><th>Requests</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in categories" :key="c.id">
                <td><strong>{{ c.name }}</strong></td>
                <td>{{ c.description || '—' }}</td>
                <td>{{ c.request_count }}</td>
                <td>
                  <span class="badge" :class="c.is_active ? 'badge-completed' : 'badge-cancelled'">
                    {{ c.is_active ? 'active' : 'hidden' }}
                  </span>
                </td>
                <td>
                  <div class="btn-row">
                    <button class="btn-secondary btn-small" @click="startEdit(c)">Edit</button>
                    <button class="btn-danger btn-small" @click="deleteCategory(c)">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- MEMBERS -------------------------------------------------------------->
    <div v-else-if="tab === 'users'" class="card">
      <h2>Members</h2>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Requests</th><th>Reports</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td><strong>{{ u.name }}</strong></td>
              <td>{{ u.email }}</td>
              <td>
                <span v-if="u.role === 'admin'" class="badge badge-matched">admin</span>
                <span v-else class="item-meta">user</span>
              </td>
              <td>{{ u.request_count }}</td>
              <td>
                <span v-if="u.open_reports > 0" class="badge badge-high">{{ u.open_reports }}</span>
                <span v-else class="item-meta">—</span>
              </td>
              <td>
                <span class="badge" :class="u.is_active ? 'badge-completed' : 'badge-cancelled'">
                  {{ u.is_active ? 'active' : 'deactivated' }}
                </span>
              </td>
              <td>
                <button
                  class="btn-small"
                  :class="u.is_active ? 'btn-danger' : 'btn-success'"
                  @click="toggleUser(u)"
                >
                  {{ u.is_active ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- REPORTS -------------------------------------------------------------->
    <div v-else class="card">
      <h2>Reports</h2>

      <div v-if="reports.length === 0" class="empty">No reports have been submitted.</div>

      <div v-for="r in reports" :key="r.id" class="item">
        <div class="item-head">
          <div>
            <div class="item-title">{{ r.reason }}</div>
            <div class="item-meta">
              {{ r.reporter_name }} reported {{ r.reported_user_name }} · {{ formatDate(r.created_at) }}
              <span class="badge" :class="'badge-' + r.status">{{ r.status }}</span>
            </div>
          </div>

          <div class="item-actions">
            <template v-if="r.status === 'open'">
              <button class="btn-success btn-small" @click="setReportStatus(r, 'resolved')">
                Resolve
              </button>
              <button class="btn-secondary btn-small" @click="setReportStatus(r, 'dismissed')">
                Dismiss
              </button>
            </template>
          </div>
        </div>

        <div v-if="r.details" class="item-body">{{ r.details }}</div>
      </div>
    </div>
  </template>
</template>
