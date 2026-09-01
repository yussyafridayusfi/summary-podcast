<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  aiApi,
  foodApi,
  type AiStatus,
  type ExportFormat,
  type FoodGenerateContext,
  type FoodReview,
} from "../api/client";
import RichEditor from "../components/RichEditor.vue";
import ExportModal from "../components/ExportModal.vue";
import { firstImageInHtml } from "../lib/image";

const props = defineProps<{ id: string }>();

const review = ref<FoodReview | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const generating = ref(false);
const saving = ref(false);
const savedAt = ref<string | null>(null);

const aiStatus = ref<AiStatus | null>(null);
const exportFormat = ref<ExportFormat | null>(null);

/** Editable copy of the record; the AI reads these values, saved or not. */
const form = reactive({
  restoName: "",
  description: "",
  dateVisit: "",
  location: "",
  urlWebResto: "",
  content: "",
  imageDataUri: null as string | null,
});

/** The generated summary, editable before it's saved or exported. */
const generated = ref("");

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const r = await foodApi.get(props.id);
    review.value = r;
    form.restoName = r.restoName;
    form.description = r.description ?? "";
    form.dateVisit = r.dateVisit ?? "";
    form.location = r.location ?? "";
    form.urlWebResto = r.urlWebResto ?? "";
    form.content = r.content;
    form.imageDataUri = r.imageDataUri;
    generated.value = r.summaryGeneratorText;
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

/** First image embedded in the notes, used when no photo field is set. */
const notesPhoto = computed(() => firstImageInHtml(form.content));

/**
 * What the export actually puts on the card. The photo field wins, but an image
 * dropped into the notes counts too — that is where people put it.
 */
const effectivePhoto = computed(() => form.imageDataUri ?? notesPhoto.value);

const photoSource = computed<"field" | "notes" | "none">(() =>
  form.imageDataUri ? "field" : notesPhoto.value ? "notes" : "none",
);

const context = computed<FoodGenerateContext>(() => ({
  type: "food-review",
  restoName: form.restoName,
  description: form.description || null,
  dateVisit: form.dateVisit || null,
  location: form.location || null,
  urlWebResto: form.urlWebResto || null,
  content: form.content,
  imageDataUri: effectivePhoto.value,
}));

const canGenerate = computed(() => !!form.restoName.trim());

/** The editor leaves markup like `<p><br></p>` behind, so test the text. */
const hasNotes = computed(
  () =>
    form.content
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0,
);

/** Either source is enough to design an export from. */
const canExport = computed(() => hasNotes.value || !!generated.value.trim());

const dirty = computed(() => {
  const r = review.value;
  if (!r) return false;
  return (
    form.restoName !== r.restoName ||
    form.description !== (r.description ?? "") ||
    form.dateVisit !== (r.dateVisit ?? "") ||
    form.location !== (r.location ?? "") ||
    form.urlWebResto !== (r.urlWebResto ?? "") ||
    form.content !== r.content ||
    form.imageDataUri !== r.imageDataUri ||
    generated.value !== r.summaryGeneratorText
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

async function persist() {
  saving.value = true;
  try {
    const updated = await foodApi.patch(props.id, {
      restoName: form.restoName.trim(),
      description: form.description.trim() || null,
      dateVisit: form.dateVisit || null,
      location: form.location.trim() || null,
      urlWebResto: form.urlWebResto.trim() || null,
      content: form.content,
      imageDataUri: form.imageDataUri,
      summaryGeneratorText: generated.value,
    });
    review.value = updated;
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

const EXPORTS: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "img", label: "Image", hint: "Instagram-ready post" },
  { key: "pdf", label: "PDF", hint: "Print-ready page" },
  { key: "html", label: "HTML", hint: "Self-contained web page" },
];

onMounted(() => {
  load();
  loadStatus();
});
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <!-- Breadcrumb -->
    <nav class="mb-4 flex items-center gap-2 overflow-hidden text-sm text-slate-500">
      <router-link to="/food" class="flex-none hover:text-indigo-600">
        Food reviews
      </router-link>
      <svg class="h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <router-link
        v-if="review"
        :to="{ name: 'food-detail', params: { id } }"
        class="max-w-[14rem] truncate hover:text-indigo-600"
      >
        {{ review.restoName }}
      </router-link>
      <svg class="h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="flex-none font-medium text-slate-700">Generate</span>
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

    <div v-else-if="review" class="space-y-6">
      <!-- Source fields -->
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 class="text-xl font-semibold text-slate-900">Generate summary</h1>
        <p class="mt-1 text-sm text-slate-500">
          Edit any detail below, then generate. Changes are saved with the review.
        </p>

        <!-- Photo used by the image export -->
        <div v-if="effectivePhoto" class="mt-5">
          <img
            :src="effectivePhoto"
            alt="Food photo"
            class="max-h-72 w-full rounded-lg object-cover"
          />
          <p class="mt-1.5 text-xs text-slate-400">
            <template v-if="photoSource === 'notes'">
              Taken from the first image in your notes — it's the centrepiece of the
              image export. Set a Food photo on the edit screen to use a different one.
            </template>
            <template v-else>
              This photo is used as the centrepiece of the generated image export.
            </template>
          </p>
        </div>
        <p v-else class="mt-5 text-xs text-amber-700">
          No photo yet — the image export will use a placeholder. Add a Food photo on
          the edit screen, or drop one into the notes below with the image button.
        </p>

        <div class="mt-5 space-y-5">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label for="g-resto" class="mb-1.5 block text-sm font-medium text-slate-700">
                Restaurant name <span class="text-rose-500">*</span>
              </label>
              <input
                id="g-resto"
                v-model="form.restoName"
                class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label for="g-desc" class="mb-1.5 block text-sm font-medium text-slate-700">
                Description
                <span class="text-xs font-normal text-slate-400">(what you ate)</span>
              </label>
              <input
                id="g-desc"
                v-model="form.description"
                placeholder="e.g. Nasi goreng kambing"
                class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label for="g-date" class="mb-1.5 block text-sm font-medium text-slate-700">
                Date visited
                <span class="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="g-date"
                v-model="form.dateVisit"
                type="date"
                class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label for="g-loc" class="mb-1.5 block text-sm font-medium text-slate-700">
                Location
                <span class="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="g-loc"
                v-model="form.location"
                placeholder="e.g. Bandung, Jawa Barat"
                class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label for="g-url" class="mb-1.5 block text-sm font-medium text-slate-700">
              Restaurant website
              <span class="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="g-url"
              v-model="form.urlWebResto"
              type="url"
              placeholder="https://example.com/restaurant"
              class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Notes
              <span class="text-xs font-normal text-slate-400">
                (the raw material the AI summarises)
              </span>
            </label>
            <RichEditor v-model="form.content" min-height="12rem" />
          </div>
        </div>

        <!-- Generate -->
        <div
          class="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p v-if="aiStatus && !aiStatus.textReady" class="text-xs text-rose-700">
              No AI text provider is configured — add a key to
              <code class="rounded bg-rose-50 px-1">backend/.env</code> to enable this.
            </p>
            <p v-else-if="aiStatus" class="text-xs text-slate-500">
              Using {{ aiStatus.provider }} · {{ aiStatus.model }}
            </p>
            <p v-if="dirty" class="mt-1 text-xs font-medium text-rose-700">
              Unsaved changes
            </p>
            <p v-else-if="savedAt" class="mt-1 text-xs text-indigo-600">
              Saved {{ savedAt }}
            </p>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              :disabled="saving || !dirty"
              class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              @click="save"
            >
              {{ saving ? "Saving…" : "Save changes" }}
            </button>

            <button
              type="button"
              :disabled="generating || !canGenerate"
              class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
        class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ generating || generated ? "Generated summary" : "Export" }}
            </h2>
            <p v-if="generating || generated" class="mt-1 text-sm text-slate-500">
              Stored with the review. Edit freely before exporting.
            </p>
            <p v-else class="mt-1 text-sm text-slate-500">
              No summary generated yet — you can still export straight from your notes.
            </p>
          </div>
          <span
            v-if="savedAt"
            class="inline-flex flex-none items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
          >
            Saved {{ savedAt }}
          </span>
        </div>

        <!-- Generating loader -->
        <div
          v-if="generating"
          class="flex flex-col items-center justify-center gap-3 py-20 text-slate-500"
        >
          <svg class="h-7 w-7 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          <p class="text-sm font-medium text-slate-700">Writing your review…</p>
        </div>

        <template v-else>
          <textarea
            v-if="generated"
            v-model="generated"
            rows="12"
            class="mt-5 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          ></textarea>

          <div class="mt-6 border-t border-slate-100 pt-6">
            <p class="mb-3 text-sm font-medium text-slate-700">Export as</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in EXPORTS"
                :key="opt.key"
                type="button"
                :disabled="!canExport"
                class="inline-flex flex-col items-start rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="exportFormat = opt.key"
              >
                <span class="text-sm font-semibold text-slate-800">{{ opt.label }}</span>
                <span class="text-xs text-slate-500">{{ opt.hint }}</span>
              </button>
            </div>
            <p v-if="!canExport" class="mt-2 text-xs text-slate-400">
              Write some notes or generate a summary first.
            </p>
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
