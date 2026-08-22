<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, type Summary, type SummaryInput } from "./api/client";
import { getOrCreateUserId } from "./api/user";
import SummaryForm from "./components/SummaryForm.vue";
import SummaryList from "./components/SummaryList.vue";
import SummaryView from "./components/SummaryView.vue";

const userId = ref("");
const items = ref<Summary[]>([]);
const selectedId = ref<string | null>(null);
const mode = ref<"view" | "edit" | "create">("view");
const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

const selected = computed<Summary | null>(
  () => items.value.find((s) => s.id === selectedId.value) ?? null,
);

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const { items: list } = await api.list();
    items.value = list;
    if (selectedId.value && !list.some((s) => s.id === selectedId.value)) {
      selectedId.value = null;
      mode.value = list.length ? "view" : "create";
    }
    if (!selectedId.value && list.length) selectedId.value = list[0].id;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function startNew() {
  selectedId.value = null;
  mode.value = "create";
}

function startEdit() {
  if (selected.value) mode.value = "edit";
}

function cancelForm() {
  if (selected.value) {
    mode.value = "view";
  } else {
    mode.value = items.value.length ? "view" : "create";
  }
}

async function onSubmit(input: SummaryInput) {
  submitting.value = true;
  error.value = null;
  try {
    if (mode.value === "create" || !selected.value) {
      const created = await api.create(input);
      items.value = [created, ...items.value];
      selectedId.value = created.id;
      mode.value = "view";
    } else {
      const updated = await api.update(selected.value.id, input);
      items.value = items.value.map((s) => (s.id === updated.id ? updated : s));
      mode.value = "view";
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

async function onDelete(id: string) {
  if (!confirm("Delete this summary?")) return;
  error.value = null;
  try {
    await api.remove(id);
    items.value = items.value.filter((s) => s.id !== id);
    if (selectedId.value === id) selectedId.value = items.value[0]?.id ?? null;
    mode.value = items.value.length ? "view" : "create";
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(() => {
  userId.value = getOrCreateUserId();
  refresh();
});
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>🎙️ Podcast Summary</h1>
      <span class="user" :title="userId">user: {{ userId.slice(0, 8) }}…</span>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="layout">
      <SummaryList
        :items="items"
        :selected-id="selectedId"
        :loading="loading"
        @select="(id) => { selectedId = id; mode = 'view'; }"
        @new="startNew"
      />

      <SummaryForm
        v-if="mode === 'create' || mode === 'edit'"
        :initial="mode === 'edit' ? selected : null"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="cancelForm"
        @delete="onDelete"
      />

      <SummaryView
        v-else-if="selected"
        :summary="selected"
        @edit="startEdit"
      />

      <section v-else class="empty">
        <h2>No summary selected</h2>
        <p class="meta">Create one to get started.</p>
        <button class="primary" @click="startNew">+ New summary</button>
      </section>
    </div>
  </div>
</template>
