<script setup lang="ts">
import { reactive, watch, ref } from "vue";
import RichEditor from "./RichEditor.vue";
import ImageScanner from "./ImageScanner.vue";
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
  guest: "",
  url: "",
  content: "",
});

const showScanner = ref(false);
const inputMode = ref<'write' | 'scan'>('write');

watch(
  () => props.initial,
  (s) => {
    form.podcastName = s?.podcastName ?? "";
    form.sessionTitle = s?.sessionTitle ?? "";
    form.guest = s?.guest ?? "";
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
    guest: form.guest.trim() ? form.guest.trim() : null,
    url: form.url.trim() ? form.url.trim() : null,
    content: form.content,
  };
  emit("submit", input);
}

/**
 * Handle text extracted from OCR scanner
 */
function onTextExtracted(text: string) {
  // Append extracted text to existing content
  if (form.content && !form.content.endsWith('\n')) {
    form.content += '\n\n';
  }
  form.content += text;
  // Close scanner after extraction
  setTimeout(() => {
    showScanner.value = false;
    inputMode.value = 'write';
  }, 500);
}
</script>

<template>
  <form class="space-y-9" @submit.prevent="onSubmit">
    <!-- Header -->
    <header>
      <h1 class="font-serif text-display text-ink">
        {{ initial ? "Edit summary" : "New summary" }}
      </h1>
      <p class="mt-2 text-sm text-ink-muted">
        {{
          initial
            ? "Change anything you like, then save."
            : "Jot down what stayed with you from the episode."
        }}
      </p>
    </header>

    <!-- Episode details -->
    <fieldset class="space-y-6">
      <legend class="sr-only">Episode details</legend>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label for="podcast" class="label">
            Podcast
            <span class="label-hint" aria-hidden="true">required</span>
          </label>
          <input
            id="podcast"
            v-model="form.podcastName"
            required
            autocomplete="off"
            placeholder="Huberman Lab"
            class="field"
          />
        </div>
        <div>
          <label for="session" class="label">
            Session title
            <span class="label-hint" aria-hidden="true">required</span>
          </label>
          <input
            id="session"
            v-model="form.sessionTitle"
            required
            autocomplete="off"
            placeholder="Ep 1 — Sleep &amp; adenosine"
            class="field"
          />
        </div>
        <div>
          <label for="guest" class="label">
            Guest
            <span class="label-hint">optional</span>
          </label>
          <input
            id="guest"
            v-model="form.guest"
            autocomplete="off"
            placeholder="Dr. Matt Walker"
            class="field"
          />
        </div>
        <div>
          <label for="url" class="label">
            Link
            <span class="label-hint">optional</span>
          </label>
          <input
            id="url"
            v-model="form.url"
            type="url"
            placeholder="https://example.com/episode-1"
            class="field"
          />
        </div>
      </div>
    </fieldset>

    <!-- Notes Section -->
    <div>
      <div class="mb-4 flex items-baseline justify-between gap-4">
        <span id="notes-label" class="label mb-0">Notes</span>
        <div class="flex gap-2">
          <button
            type="button"
            :class="[
              'text-xs font-medium px-3 py-1 rounded-lg transition-colors',
              inputMode === 'write'
                ? 'bg-accent text-white'
                : 'bg-ink-faint/10 text-ink-faint hover:text-ink hover:bg-ink-faint/20'
            ]"
            @click="inputMode = 'write'; showScanner = false"
          >
            ✏️ Write
          </button>
          <button
            type="button"
            :class="[
              'text-xs font-medium px-3 py-1 rounded-lg transition-colors',
              inputMode === 'scan'
                ? 'bg-accent text-white'
                : 'bg-ink-faint/10 text-ink-faint hover:text-ink hover:bg-ink-faint/20'
            ]"
            @click="inputMode = 'scan'; showScanner = !showScanner"
          >
            📸 Scan
          </button>
        </div>
      </div>

      <!-- Write Mode -->
      <div v-show="inputMode === 'write'" class="space-y-3">
        <span class="hidden text-xs text-ink-faint sm:inline">
          Bold, lists, headings, quotes and code all work
        </span>
        <RichEditor
          v-model="form.content"
          placeholder="Write your summary here…"
          role="group"
          aria-labelledby="notes-label"
        />
      </div>

      <!-- Scan Mode -->
      <div v-show="inputMode === 'scan'" class="space-y-4">
        <ImageScanner
          :on-text-extracted="onTextExtracted"
          @text-extracted="onTextExtracted"
        />
        <div v-if="form.content" class="p-4 rounded-lg bg-accent-soft/20 border border-accent-soft">
          <p class="text-sm text-ink-muted mb-3">Current notes preview:</p>
          <div class="text-sm text-ink font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {{ form.content }}
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div
      class="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <button
        v-if="initial"
        type="button"
        class="btn btn-danger-quiet w-full sm:w-auto"
        @click="emit('delete', initial.id)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        Delete summary
      </button>
      <span v-else class="hidden sm:block"></span>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button type="button" class="btn btn-ghost" @click="emit('cancel')">
          Cancel
        </button>
        <button type="submit" :disabled="submitting" class="btn btn-primary">
          <svg
            v-if="submitting"
            class="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle class="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
            <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V1C5.9 1 1 5.9 1 12h3z" />
          </svg>
          {{ submitting ? "Saving…" : initial ? "Save changes" : "Create summary" }}
        </button>
      </div>
    </div>
  </form>
</template>
