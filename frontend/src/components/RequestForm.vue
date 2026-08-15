<script setup>
// RequestForm.vue — one form used for BOTH creating and editing a request.
//
// props  = data in from the parent (null request = "create" mode)
// emits  = events out to the parent, which does the API call
import { ref, watch, onMounted } from 'vue';
import api from '../services/api';

const props = defineProps({
  request: { type: Object, default: null },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'cancel']);

const categories = ref([]);
const errors = ref({});

const form = ref({
  title: '',
  description: '',
  category_id: '',
  urgency: 'normal',
  street: '',
  needed_by: '',
});

function blank() {
  return {
    title: '',
    description: '',
    category_id: categories.value[0]?.id || '',
    urgency: 'normal',
    street: '',
    needed_by: '',
  };
}

onMounted(async () => {
  const { data } = await api.get('/categories');
  categories.value = data;
  if (!props.request && !form.value.category_id) {
    form.value.category_id = data[0]?.id || '';
  }
});

// Refill the form whenever the parent switches which request we edit.
watch(
  () => props.request,
  (request) => {
    errors.value = {};
    if (request) {
      form.value = {
        title: request.title,
        description: request.description,
        category_id: request.category_id,
        urgency: request.urgency,
        street: request.street || '',
        // The date input needs yyyy-mm-dd, not a full timestamp.
        needed_by: request.needed_by ? String(request.needed_by).slice(0, 10) : '',
      };
    } else {
      form.value = blank();
    }
  },
  { immediate: true }
);

function validate() {
  errors.value = {};

  if (!form.value.title.trim()) {
    errors.value.title = 'Please give your request a short title';
  } else if (form.value.title.length > 120) {
    errors.value.title = 'Title must be 120 characters or fewer';
  }

  if (!form.value.description.trim()) {
    errors.value.description = 'Please describe what you need help with';
  } else if (form.value.description.trim().length < 15) {
    errors.value.description = 'A little more detail will get you better matches';
  }

  if (!form.value.category_id) {
    errors.value.category_id = 'Please choose a category';
  }

  // A date in the past makes no sense for something you still need.
  if (form.value.needed_by) {
    const today = new Date().toISOString().slice(0, 10);
    if (form.value.needed_by < today) {
      errors.value.needed_by = 'That date has already passed';
    }
  }

  return Object.keys(errors.value).length === 0;
}

function handleSubmit() {
  if (!validate()) return;
  emit('save', { ...form.value });
}

function resetForm() {
  form.value = blank();
  errors.value = {};
}

// Lets the parent clear the form after a successful save.
defineExpose({ resetForm });
</script>

<template>
  <div class="card">
    <h2>{{ props.request ? 'Edit request' : 'Ask for help' }}</h2>

    <!-- novalidate: our own messages, not the browser's popups -->
    <form novalidate @submit.prevent="handleSubmit">
      <div class="field">
        <label for="title">What do you need? (short title)</label>
        <input id="title" v-model="form.title" type="text" placeholder="e.g. Help moving a sofa on Saturday" />
        <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
      </div>

      <div class="form-row">
        <div class="field">
          <label for="category">Category</label>
          <select id="category" v-model="form.category_id">
            <option value="" disabled>Choose one…</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <p v-if="errors.category_id" class="field-error">{{ errors.category_id }}</p>
        </div>

        <div class="field">
          <label for="urgency">Urgency</label>
          <select id="urgency" v-model="form.urgency">
            <option value="low">Low — whenever suits</option>
            <option value="normal">Normal — within a week</option>
            <option value="high">High — in the next day or two</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label for="description">Describe it</label>
        <textarea
          id="description"
          v-model="form.description"
          placeholder="What needs doing, roughly how long it might take, and anything a helper should know."
        ></textarea>
        <p v-if="errors.description" class="field-error">{{ errors.description }}</p>
      </div>

      <div class="form-row">
        <div class="field">
          <label for="street">Street (optional)</label>
          <input id="street" v-model="form.street" type="text" placeholder="Leave blank to use your own address" />
          <p class="hint">Neighbours only ever see the street name, never the house number.</p>
        </div>

        <div class="field">
          <label for="needed_by">Needed by (optional)</label>
          <input id="needed_by" v-model="form.needed_by" type="date" />
          <p v-if="errors.needed_by" class="field-error">{{ errors.needed_by }}</p>
        </div>
      </div>

      <div class="btn-row">
        <button type="submit" class="btn-primary" :disabled="props.saving">
          {{ props.saving ? 'Saving…' : props.request ? 'Save changes' : 'Post request' }}
        </button>
        <button v-if="props.request" type="button" class="btn-secondary" @click="emit('cancel')">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
