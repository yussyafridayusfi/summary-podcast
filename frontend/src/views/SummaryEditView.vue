<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type Summary, type SummaryInput } from "../api/client";
import SummaryForm from "../components/SummaryForm.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";

const props = defineProps<{ id: string }>();
const router = useRouter();

const summary = ref<Summary | null>(null);
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);
const confirmingDelete = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    summary.value = await api.get(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function onSubmit(input: SummaryInput) {
  if (!summary.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const updated = await api.update(summary.value.id, input);
    router.push({ name: "detail", params: { id: updated.id } });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

function onDelete() {
  confirmingDelete.value = true;
}

async function confirmDelete() {
  confirmingDelete.value = false;
  try {
    await api.remove(props.id);
    router.push({ name: "list" });
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function onCancel() {
  router.push({ name: "detail", params: { id: props.id } });
}

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <!-- Breadcrumb -->
    <nav
      class="mb-8 flex items-center gap-2 overflow-hidden text-xs tracking-wide text-ink-faint"
    >
      <router-link
        to="/"
        class="flex-none rounded transition-colors duration-150 hover:text-accent"
      >
        My summaries
      </router-link>
      <span aria-hidden="true">/</span>
      <router-link
        v-if="summary"
        :to="{ name: 'detail', params: { id } }"
        class="max-w-[14rem] truncate rounded transition-colors duration-150 hover:text-accent"
      >
        {{ summary.sessionTitle }}
      </router-link>
      <span v-if="summary" aria-hidden="true">/</span>
      <span class="flex-none text-ink-muted">Edit</span>
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

    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-8 py-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="space-y-3">
        <div class="h-7 w-56 rounded-full bg-paper-dim"></div>
        <div class="h-3 w-72 rounded-full bg-paper-dim"></div>
      </div>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div class="h-11 rounded-xl bg-paper-dim"></div>
        <div class="h-11 rounded-xl bg-paper-dim"></div>
        <div class="h-11 rounded-xl bg-paper-dim"></div>
        <div class="h-11 rounded-xl bg-paper-dim"></div>
      </div>
      <div class="h-64 rounded-xl bg-paper-dim"></div>
    </div>

    <SummaryForm
      v-else-if="summary"
      :initial="summary"
      :submitting="submitting"
      @submit="onSubmit"
      @cancel="onCancel"
      @delete="onDelete"
    />

    <ConfirmDialog
      :open="confirmingDelete"
      title="Delete this summary?"
      :message="summary ? `“${summary.sessionTitle}” will be permanently deleted. This can't be undone.` : ''"
      confirm-text="Delete"
      danger
      @confirm="confirmDelete"
      @cancel="confirmingDelete = false"
    />
  </section>
</template>
