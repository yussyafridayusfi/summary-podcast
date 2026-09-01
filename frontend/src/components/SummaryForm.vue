<script setup lang="ts">
import { reactive, watch } from "vue";
import RichEditor from "./RichEditor.vue";
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

const form = reactive({
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
  const input: SummaryInput = {
    podcastName: form.podcastName.trim(),
    sessionTitle: form.sessionTitle.trim(),
    url: form.url.trim() ? form.url.trim() : null,
    content: form.content,
  };
  emit("submit", input);
}
</script>

<template>
  <form
    class="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    @submit.prevent="onSubmit"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">
          {{ initial ? "Edit summary" : "Create a new summary" }}
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          {{
            initial
              ? "Update the details below and save your changes."
              : "Capture the key takeaways from a podcast episode."
          }}
        </p>
      </div>
      <span
        v-if="initial"
        class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
      >
        Editing
      </span>
    </div>

    <!-- Required fields -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label for="podcast" class="mb-1.5 block text-sm font-medium text-slate-700">
          Podcast name
          <span class="text-rose-500">*</span>
        </label>
        <input
          id="podcast"
          v-model="form.podcastName"
          required
          placeholder="e.g. Huberman Lab"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      <div>
        <label for="session" class="mb-1.5 block text-sm font-medium text-slate-700">
          Session title
          <span class="text-rose-500">*</span>
        </label>
        <input
          id="session"
          v-model="form.sessionTitle"
          required
          placeholder="e.g. Ep 1 — Sleep & adenosine"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>

    <!-- URL -->
    <div>
      <label for="url" class="mb-1.5 block text-sm font-medium text-slate-700">
        URL
        <span class="text-xs font-normal text-slate-400">(optional)</span>
      </label>
      <div class="relative">
        <span
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
        <input
          id="url"
          v-model="form.url"
          type="url"
          placeholder="https://example.com/episode-1"
          class="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>

    <!-- WYSIWYG -->
    <div>
      <label class="mb-1.5 block text-sm font-medium text-slate-700">
        Notes
        <span class="text-xs font-normal text-slate-400">
          (rich text — bold, lists, headings, quotes, code)
        </span>
      </label>
      <RichEditor
        v-model="form.content"
        placeholder="Write your summary here…"
      />
    </div>

    <!-- Actions -->
    <div
      class="flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <button
        v-if="initial"
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
        @click="emit('delete', initial.id)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        Delete
      </button>
      <span v-else></span>
      <div class="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            v-if="!submitting"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.949A.75.75 0 004.42 8.71l1.116-.267a.75.75 0 01.49.063L8 9.586l2.022-1.18a.75.75 0 01.49-.063l1.117.267a.75.75 0 00.726-.521l1.414-4.949a.75.75 0 00-.826-.95L10 2.81 3.105 2.29zM5 11.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5z"
            />
          </svg>
          <span v-if="submitting" class="inline-block animate-spin">⏳</span>
          {{ submitting ? "Saving…" : initial ? "Save changes" : "Create summary" }}
        </button>
      </div>
    </div>
  </form>
</template>
