<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  aiApi,
  type ExportFormat,
  type ExportSource,
  type GenerateContext,
} from "../api/client";
import {
  SKETCH_H,
  SKETCH_W,
  autoFitSketch,
  composeDocument,
  materialiseSketch,
  composeSketchDocument,
  downloadHtml,
  downloadPdf,
  downloadPng,
  slugify,
} from "../lib/export";

const props = defineProps<{
  open: boolean;
  format: ExportFormat;
  context: GenerateContext;
  summaryText: string;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

type Stage = "prompt" | "generating" | "preview" | "downloading";

const stage = ref<Stage>("prompt");
const prompt = ref("");
const source = ref<ExportSource>("summary");
const error = ref<string | null>(null);
const composedHtml = ref("");
const progress = ref("");
const frame = ref<HTMLIFrameElement | null>(null);
const previewBox = ref<HTMLElement | null>(null);

// The square card renders at its true 1080px so the capture is pixel-exact;
// it's only scaled down visually to fit the modal.
const imgScale = ref(0.3);
let observer: ResizeObserver | null = null;

function measure() {
  const box = previewBox.value;
  if (box) imgScale.value = box.clientWidth / SKETCH_W;
}

watch(previewBox, (box) => {
  observer?.disconnect();
  observer = null;
  if (!box) return;
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(box);
});

const META: Record<
  ExportFormat,
  { title: string; label: string; hint: string; examples: string[] }
> = {
  img: {
    title: "Generate an image",
    label: "Hand-drawn sketchnote, Instagram portrait (1080×1350)",
    hint: "Drawn as a real layout — dot-grid paper, handwriting, highlighter marks and doodles — so every word stays sharp.",
    examples: [
      "I want a sketchy summary for an IG post",
      "Bullet-journal style with lots of doodles and highlighter",
      "Minimal sketchnote, mostly black pen, one accent colour",
    ],
  },
  pdf: {
    title: "Generate a PDF",
    label: "Print-ready document",
    hint: "Rendered to A4 and paginated automatically if it runs long.",
    examples: [
      "A clean one-page briefing note for my team",
      "Academic handout style with a serif body and footnotes",
      "Minimal executive summary, lots of whitespace",
    ],
  },
  html: {
    title: "Generate a web page",
    label: "Self-contained HTML file",
    hint: "Downloads as a single .html file with all styles inlined.",
    examples: [
      "A modern blog-post style page with a hero header",
      "Dark-mode landing page with big type",
      "Simple documentation page with a sidebar of takeaways",
    ],
  },
};

const meta = computed(() => META[props.format]);

const filename = computed(() =>
  slugify(
    `${props.context.podcastName}-${props.context.sessionTitle}`.trim() ||
      "summary",
  ),
);

/** Quill leaves markup like `<p><br></p>` behind, so test the text content. */
function hasText(html: string): boolean {
  return (
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

const hasNotes = computed(() => hasText(props.context.content ?? ""));
const hasSummary = computed(() => !!props.summaryText.trim());

const SOURCES: { key: ExportSource; label: string }[] = [
  { key: "notes", label: "Use my notes" },
  { key: "summary", label: "Use AI summary" },
];

function sourceAvailable(key: ExportSource): boolean {
  return key === "notes" ? hasNotes.value : hasSummary.value;
}

/** Prefer the AI summary when there is one, else fall back to the notes. */
function defaultSource(): ExportSource {
  return hasSummary.value ? "summary" : "notes";
}

const sourceHint = computed(() =>
  source.value === "notes"
    ? "Designed straight from your own notes — no AI summary involved."
    : "Designed from the AI-generated summary.",
);

function reset() {
  stage.value = "prompt";
  error.value = null;
  composedHtml.value = "";
  progress.value = "";
  source.value = defaultSource();
}

// Start each opening from a clean slate, keeping whatever prompt was typed.
// Immediate, because the modal is mounted already-open by its parent.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset();
  },
  { immediate: true },
);

// If the selected source loses its content, fall back to one that has some.
watch([hasNotes, hasSummary], () => {
  if (!sourceAvailable(source.value)) source.value = defaultSource();
});

watch(
  () => props.format,
  () => {
    prompt.value = "";
    reset();
  },
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && stage.value !== "generating") emit("close");
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  observer?.disconnect();
});

async function generate() {
  stage.value = "generating";
  error.value = null;
  try {
    progress.value =
      props.format === "img"
        ? "Drawing your sketchnote…"
        : "Designing the layout…";

    const design = await aiApi.design({
      ...props.context,
      format: props.format,
      prompt: prompt.value,
      source: source.value,
      summaryText: props.summaryText,
    });

    composedHtml.value =
      props.format === "img"
        ? composeSketchDocument(design.html)
        : composeDocument(design.html);

    stage.value = "preview";
  } catch (e) {
    error.value = (e as Error).message;
    stage.value = "prompt";
  }
}

/** Mirrors the capture-time fit so the preview matches the downloaded file. */
function onFrameLoad() {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  materialiseSketch(doc);
  autoFitSketch(doc);
}

async function accept() {
  error.value = null;
  stage.value = "downloading";
  try {
    if (props.format === "html") {
      downloadHtml(composedHtml.value, filename.value);
    } else {
      const el = frame.value;
      if (!el) throw new Error("preview is not ready yet");
      if (props.format === "img") await downloadPng(el, filename.value);
      else await downloadPdf(el, filename.value);
    }
    emit("close");
  } catch (e) {
    error.value = (e as Error).message;
    stage.value = "preview";
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-4 backdrop-blur-[2px] sm:items-center"
      @click.self="stage !== 'generating' && emit('close')"
    >
      <div
        class="dialog-panel my-auto w-full max-w-2xl rounded-2xl border border-line-soft bg-surface shadow-[0_18px_50px_-12px_rgb(33_31_28/0.3)]"
        role="dialog"
        aria-modal="true"
        :aria-label="meta.title"
      >
        <!-- Header -->
        <header
          class="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5"
        >
          <div>
            <h2 class="font-serif text-title text-ink">
              {{ meta.title }}
            </h2>
            <p class="mt-1 text-sm text-ink-muted">{{ meta.label }}</p>
          </div>
          <button
            type="button"
            class="icon-btn disabled:opacity-40"
            :disabled="stage === 'generating'"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </header>

        <div class="px-6 py-5">
          <!-- Error -->
          <div
            v-if="error"
            class="notice-danger mb-5"
          >
            <svg
              class="mt-0.5 h-4 w-4 flex-none"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{{ error }}</span>
          </div>

          <!-- Prompt -->
          <div v-if="stage === 'prompt'">
            <!-- Source -->
            <div class="mb-5">
              <p class="label">What should we design?</p>
              <div
                class="inline-flex rounded-xl border border-line bg-paper-dim p-1"
                role="radiogroup"
                aria-label="Content source"
              >
                <button
                  v-for="opt in SOURCES"
                  :key="opt.key"
                  type="button"
                  role="radio"
                  :aria-checked="source === opt.key"
                  :disabled="!sourceAvailable(opt.key)"
                  :title="
                    sourceAvailable(opt.key)
                      ? undefined
                      : opt.key === 'notes'
                        ? 'Your notes are empty'
                        : 'No summary has been generated yet'
                  "
                  class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                  :class="
                    source === opt.key
                      ? 'bg-surface text-accent shadow-[0_1px_2px_rgb(33_31_28/0.10)]'
                      : 'text-ink-muted hover:text-ink'
                  "
                  @click="source = opt.key"
                >
                  {{ opt.label }}
                </button>
              </div>
              <p class="mt-2.5 text-xs text-ink-muted">{{ sourceHint }}</p>
              <p v-if="!hasNotes" class="mt-1 text-xs text-ink-faint">
                “Use my notes” is unavailable — your notes are empty.
              </p>
              <p v-else-if="!hasSummary" class="mt-1 text-xs text-ink-faint">
                “Use AI summary” is unavailable — no summary has been generated yet.
              </p>
            </div>

            <label
              for="export-prompt"
              class="label"
            >
              Describe the style you want
            </label>
            <textarea
              id="export-prompt"
              v-model="prompt"
              rows="3"
              :placeholder="meta.examples[0]"
              class="field resize-y"
            ></textarea>
            <p class="mt-2 text-xs text-ink-muted">{{ meta.hint }}</p>

            <div class="mt-4">
              <p class="label">Try one</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="ex in meta.examples"
                  :key="ex"
                  type="button"
                  class="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition duration-150 hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
                  @click="prompt = ex"
                >
                  {{ ex }}
                </button>
              </div>
            </div>
          </div>

          <!-- Generating -->
          <div
            v-else-if="stage === 'generating'"
            class="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted"
          >
            <svg class="h-7 w-7 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
              />
            </svg>
            <p class="text-sm font-medium text-ink">{{ progress }}</p>
            <p class="text-xs text-ink-faint">
              This can take up to a minute on the free tier.
            </p>
          </div>

          <!-- Preview -->
          <div v-else>
            <p class="label">Preview</p>
            <div
              ref="previewBox"
              class="relative overflow-hidden rounded-xl border border-line bg-paper-dim"
              :class="format === 'img' ? 'aspect-[4/5]' : 'h-[26rem]'"
            >
              <!-- Sandboxed: isolates the generated CSS and blocks any scripts. -->
              <iframe
                ref="frame"
                :srcdoc="composedHtml"
                sandbox="allow-same-origin"
                class="border-0 bg-surface"
                :class="format === 'img' ? 'absolute left-0 top-0' : 'h-full w-full'"
                :style="
                  format === 'img'
                    ? {
                        width: SKETCH_W + 'px',
                        height: SKETCH_H + 'px',
                        transform: `scale(${imgScale})`,
                        transformOrigin: 'top left',
                      }
                    : undefined
                "
                title="Generated preview"
                @load="onFrameLoad"
              ></iframe>
            </div>
            <p class="mt-2.5 text-xs text-ink-faint">
              Accepting downloads the file to your computer.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <footer
          class="flex flex-col-reverse gap-2 border-t border-line-soft px-6 py-5 sm:flex-row sm:justify-end"
        >
          <button
            type="button"
            class="btn btn-quiet"
            :disabled="stage === 'generating' || stage === 'downloading'"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            v-if="stage === 'preview' || stage === 'downloading'"
            type="button"
            class="btn btn-quiet"
            :disabled="stage === 'downloading'"
            @click="generate"
          >
            Regenerate
          </button>
          <button
            v-if="stage !== 'preview' && stage !== 'downloading'"
            type="button"
            class="btn btn-primary"
            :disabled="stage === 'generating' || !sourceAvailable(source)"
            @click="generate"
          >
            {{ stage === "generating" ? "Generating…" : "Generate" }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            :disabled="stage === 'downloading'"
            @click="accept"
          >
            <svg
              v-if="stage === 'downloading'"
              class="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
              />
            </svg>
            {{ stage === "downloading" ? "Preparing…" : "Accept & download" }}
          </button>
        </footer>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Mirrors ConfirmDialog so both modals feel like the same object. */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 180ms ease;
}
.dialog-enter-active .dialog-panel,
.dialog-leave-active .dialog-panel {
  transition:
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
