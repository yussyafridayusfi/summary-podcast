<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { foodApi, type FoodReviewInput } from "../api/client";
import FoodReviewForm from "../components/FoodReviewForm.vue";

const router = useRouter();
const submitting = ref(false);
const error = ref<string | null>(null);

async function onSubmit(input: FoodReviewInput) {
  submitting.value = true;
  error.value = null;
  try {
    const created = await foodApi.create(input);
    router.push({ name: "food-detail", params: { id: created.id } });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

function onCancel() {
  router.push({ name: "food-list" });
}
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
      <span class="font-medium text-slate-700">New review</span>
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

    <FoodReviewForm
      :initial="null"
      :submitting="submitting"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </section>
</template>
