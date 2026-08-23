<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api, type SummaryInput } from "../api/client";
import SummaryForm from "../components/SummaryForm.vue";

const router = useRouter();
const submitting = ref(false);
const error = ref<string | null>(null);

async function onSubmit(input: SummaryInput) {
  submitting.value = true;
  error.value = null;
  try {
    const created = await api.create(input);
    router.push({ name: "detail", params: { id: created.id } });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

function onCancel() {
  router.push({ name: "list" });
}
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <!-- Breadcrumb -->
    <nav class="mb-8 flex items-center gap-2 text-xs tracking-wide text-ink-faint">
      <router-link
        to="/"
        class="rounded transition-colors duration-150 hover:text-accent"
      >
        My summaries
      </router-link>
      <span aria-hidden="true">/</span>
      <span class="text-ink-muted">New</span>
    </nav>

    <!-- Error -->
    <div v-if="error" class="notice-danger mb-6">
      <svg class="mt-0.5 h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <SummaryForm
      :initial="null"
      :submitting="submitting"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </section>
</template>
