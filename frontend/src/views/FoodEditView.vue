<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { foodApi, type FoodReview, type FoodReviewInput } from "../api/client";
import FoodReviewForm from "../components/FoodReviewForm.vue";

const props = defineProps<{ id: string }>();
const router = useRouter();

const review = ref<FoodReview | null>(null);
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    review.value = await foodApi.get(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function onSubmit(input: FoodReviewInput) {
  if (!review.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const updated = await foodApi.update(review.value.id, input);
    router.push({ name: "food-detail", params: { id: updated.id } });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

async function onDelete(id: string) {
  if (!confirm("Delete this food review? This cannot be undone.")) return;
  try {
    await foodApi.remove(id);
    router.push({ name: "food-list" });
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function onCancel() {
  router.push({ name: "food-detail", params: { id: props.id } });
}

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <!-- Breadcrumb -->
    <nav class="mb-4 flex items-center gap-2 text-sm text-slate-500">
      <router-link to="/food" class="hover:text-indigo-600">Food reviews</router-link>
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <router-link
        v-if="review"
        :to="{ name: 'food-detail', params: { id } }"
        class="max-w-xs truncate hover:text-indigo-600"
      >
        {{ review.restoName }}
      </router-link>
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="font-medium text-slate-700">Edit</span>
    </nav>

    <!-- Error -->
    <div
      v-if="error"
      class="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      <svg class="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24"
    >
      <div class="flex items-center gap-3 text-slate-500">
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        Loading…
      </div>
    </div>

    <FoodReviewForm
      v-else-if="review"
      :initial="review"
      :submitting="submitting"
      @submit="onSubmit"
      @cancel="onCancel"
      @delete="onDelete"
    />
  </section>
</template>
