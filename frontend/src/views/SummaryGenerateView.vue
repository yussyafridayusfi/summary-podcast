<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  aiApi,
  api,
  type AiStatus,
  type ExportFormat,
  type Summary,
} from "../api/client";
import RichEditor from "../components/RichEditor.vue";
import ExportModal from "../components/ExportModal.vue";

const props = defineProps<{ id: string }>();

const summary = ref<Summary | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const generating = ref(false);
const saving = ref(false);
const savedAt = ref<string | null>(null);

const aiStatus = ref<AiStatus | null>(null);

const exportFormat = ref<ExportFormat | null>(null);

/** Editable copy of the record; the AI reads these values, saved or not. */
const form = reactive({
  podcastName: "",
  sessionTitle: "",
  guest: "",
  url: "",
  content: "",
});

/** The generated summary, editable before it's saved or exported. */
const generated = ref("");

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const s = await api.get(props.id);
    summary.value = s;
    form.podcastName = s.podcastName;
    form.sessionTitle = s.sessionTitle;
    form.guest = s.guest ?? "";
    form.url = s.url ?? "";
    form.content = s.content;
    generated.value = s.summaryGeneratorText;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadStatus() {
  try {
    aiStatus.value = await aiApi.status();
  } catch {
    // Non-fatal: the generate call surfaces its own error if this fails.
  }
}

const context = computed(() => ({
  podcastName: form.podcastName,
  sessionTitle: form.sessionTitle,
  guest: form.guest || null,
  url: form.url || null,
  content: form.content,
}));

const canGenerate = computed(
  () => !!form.podcastName.trim() && !!form.sessionTitle.trim(),
);

/** Quill leaves markup like `<p><br></p>` behind, so test the text content. */
const hasNotes = computed(
  () =>
    form.content
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0,
);

/** Either source is enough to design an export from. */
const canExport = computed(() => hasNotes.value || !!generated.value.trim());

/** True when the form or generated text differs from what's stored. */
const dirty = computed(() => {
  const s = summary.value;
  if (!s) return false;
  return (
    form.podcastName !== s.podcastName ||
    form.sessionTitle !== s.sessionTitle ||
    form.guest !== (s.guest ?? "") ||
    form.url !== (s.url ?? "") ||
    form.content !== s.content ||
    generated.value !== s.summaryGeneratorText
  );
});

async function generate() {
  generating.value = true;
  error.value = null;
  savedAt.value = null;
  try {
    const { text } = await aiApi.summary(context.value);
    generated.value = text;
    // Persist straight away so the column reflects what the user just saw.
    await persist();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    generating.value = false;
  }
}

/** Writes the edited fields and the generated text back to the record. */
async function persist() {
  saving.value = true;
  try {
    const updated = await api.patch(props.id, {
      podcastName: form.podcastName.trim(),
      sessionTitle: form.sessionTitle.trim(),
      guest: form.guest.trim() ? form.guest.trim() : null,
      url: form.url.trim() ? form.url.trim() : null,
      content: form.content,
      summaryGeneratorText: generated.value,
    });
    summary.value = updated;
    savedAt.value = new Date().toLocaleTimeString();
  } finally {
    saving.value = false;
  }
}

async function save() {
  error.value = null;
  try {
    await persist();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(() => {
  load();
  loadStatus();
});
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <!-- Breadcrumb -->
    <nav class="mb-8 flex items-center gap-2 overflow-hidden text-xs tracking-wide text-ink-faint">
      <router-link to="/" class="flex-none rounded transition-colors duration-150 hover:text-accent">
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
      <span class="flex-none text-ink-muted">Generate</span>
    </nav>

    <!-- Error -->
    <div v-if="error" class="notice-danger mb-6">
      <svg class="mt-0.5 h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
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
      <div class="h-48 rounded-xl bg-paper-dim"></div>
    </div>

    <div v-else-if="summary" class="space-y-6">
      <!-- Source fields -->
      <section>
        <div>
          <h1 class="font-serif text-display text-ink">Generate summary</h1>
          <p class="mt-2 text-sm text-ink-muted">
            Edit any detail below, then generate. Changes are saved with the summary.
          </p>
        </div>

        <div class="mt-5 space-y-5">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label for="g-podcast" class="label">
                Podcast name <span class="label-hint" aria-hidden="true">required</span>
              </label>
              <input
                id="g-podcast"
                v-model="form.podcastName"
                class="field"
              />
            </div>
            <div>
              <label for="g-session" class="label">
                Session title <span class="label-hint" aria-hidden="true">required</span>
              </label>
              <input
                id="g-session"
                v-model="form.sessionTitle"
                class="field"
              />
            </div>
            <div>
              <label for="g-guest" class="label">
                Guest <span class="label-hint">optional</span>
              </label>
              <input
                id="g-guest"
                v-model="form.guest"
                placeholder="e.g. Dr. Matt Walker"
                class="field"
              />
            </div>
            <div>
              <label for="g-url" class="label">
                URL <span class="label-hint">optional</span>
              </label>
              <input
                id="g-url"
                v-model="form.url"
                type="url"
                placeholder="https://example.com/episode-1"
                class="field"
              />
            </div>
          </div>

          <div>
            <label class="label">
              Notes
              <span class="label-hint">
                (the raw material the AI summarises)
              </span>
            </label>
            <RichEditor v-model="form.content" min-height="12rem" />
          </div>
        </div>

        <!-- Generate -->
        <div
          class="mt-8 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p v-if="aiStatus && !aiStatus.textReady" class="text-xs text-danger">
              No AI text provider is configured — add a key to
              <code class="rounded bg-danger-soft px-1">backend/.env</code> to enable this.
            </p>
            <p v-else-if="aiStatus" class="text-xs text-ink-muted">
              Using {{ aiStatus.provider }} · {{ aiStatus.model }}
            </p>
            <p v-if="dirty" class="mt-1 text-xs font-medium text-danger">
              Unsaved changes
            </p>
            <p v-else-if="savedAt" class="mt-1 text-xs text-accent">
              Saved {{ savedAt }}
            </p>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <!-- Always available: edits to the notes and fields must be savable
                 even before anything has been generated. -->
            <button
              type="button"
              :disabled="saving || !dirty"
              class="btn btn-quiet"
              @click="save"
            >
              {{ saving ? "Saving…" : "Save changes" }}
            </button>

            <button
              type="button"
              :disabled="generating || !canGenerate"
              class="btn btn-primary"
              @click="generate"
            >
              <svg
                v-if="generating"
                class="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M10 1.5l1.6 4.3 4.4 1.6-4.4 1.6L10 13.3 8.4 9 4 7.4l4.4-1.6L10 1.5zM15.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
                />
              </svg>
              {{ generating ? "Generating…" : generated ? "Regenerate" : "Generate summary" }}
            </button>
          </div>
        </div>
      </section>

      <!-- Generated summary / export -->
      <section
        v-if="generating || generated || canExport"
        class="border-t border-line pt-9"
      >
        <div
          class="flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 class="font-serif text-title text-ink">
              {{ generating || generated ? "Generated summary" : "Export" }}
            </h2>
            <p v-if="generating || generated" class="mt-2 text-sm text-ink-muted">
              Stored in the summary's generated-text field. Edit freely before exporting.
            </p>
            <p v-else class="mt-2 text-sm text-ink-muted">
              No summary generated yet — you can still export straight from your own notes.
            </p>
          </div>
          <span
            v-if="savedAt"
            class="inline-flex flex-none items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
          >
            Saved {{ savedAt }}
          </span>
        </div>

        <!-- Generating loader -->
        <div
          v-if="generating"
          class="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted"
        >
          <svg class="h-7 w-7 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          <p class="text-sm font-medium text-ink">Writing your summary…</p>
        </div>

        <template v-else>
          <textarea
            v-if="generated"
            v-model="generated"
            rows="14"
            class="field mt-5 resize-y leading-relaxed"
          ></textarea>

          <!-- Saving lives in the details section above; this row is export-only. -->
          <div
            class="mt-6 flex flex-col gap-4 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-end"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span class="label mb-0">
                Export as
              </span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in [
                    { key: 'img' as const, label: 'Image' },
                    { key: 'pdf' as const, label: 'PDF' },
                    { key: 'html' as const, label: 'HTML' },
                  ]"
                  :key="opt.key"
                  type="button"
                  :disabled="!canExport"
                  class="btn btn-quiet hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
                  @click="exportFormat = opt.key"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <ExportModal
      v-if="exportFormat"
      :open="!!exportFormat"
      :format="exportFormat"
      :context="context"
      :summary-text="generated"
      @close="exportFormat = null"
    />
  </section>
</template>
