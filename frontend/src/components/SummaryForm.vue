<script setup lang="ts">
import { reactive, watch } from "vue";
import type { Summary, SummaryInput } from "../api/client";

const props = defineProps<{
  initial: Summary | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", value: SummaryInput): void;
  (e: "cancel"): void;
  (e: "delete", id: string): void;
}>();

const form = reactive<SummaryInput>({
  podcastName: "",
  sessionTitle: "",
  url: "",
  content: "",
});

watch(
  () => props.initial,
  (s) => {
    form.podcastName = s?.podcastName ?? "";
    form.sessionTitle = s?.sessionTitle ?? "";
    form.url = s?.url ?? "";
    form.content = s?.content ?? "";
  },
  { immediate: true },
);

function onSubmit() {
  if (!form.podcastName.trim() || !form.sessionTitle.trim()) return;
  emit("submit", {
    podcastName: form.podcastName.trim(),
    sessionTitle: form.sessionTitle.trim(),
    url: form.url?.trim() ? form.url.trim() : null,
    content: form.content ?? "",
  });
}
</script>

<template>
  <section class="form-card">
    <h2>{{ initial ? "Edit summary" : "New summary" }}</h2>
    <form @submit.prevent="onSubmit">
      <div class="form-row">
        <label for="podcast">Podcast name *</label>
        <input id="podcast" v-model="form.podcastName" required />
      </div>
      <div class="form-row">
        <label for="session">Session title *</label>
        <input id="session" v-model="form.sessionTitle" required />
      </div>
      <div class="form-row">
        <label for="url">URL</label>
        <input id="url" v-model="form.url" type="url" placeholder="https://…" />
      </div>
      <div class="form-row">
        <label for="content">Notes / content</label>
        <textarea id="content" v-model="form.content" />
      </div>
      <div class="form-actions">
        <button type="submit" class="primary" :disabled="submitting">
          {{ submitting ? "Saving…" : initial ? "Save changes" : "Create" }}
        </button>
        <button type="button" @click="emit('cancel')">Cancel</button>
        <button
          v-if="initial"
          type="button"
          class="danger"
          style="margin-left: auto;"
          @click="emit('delete', initial.id)"
        >
          Delete
        </button>
      </div>
    </form>
  </section>
</template>
