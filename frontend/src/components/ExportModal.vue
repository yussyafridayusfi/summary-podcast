<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  aiApi,
  contextFilename,
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
import {
  FOOD_CARD_STYLES,
  VARIANTS_PER_STYLE,
  cardFromReview,
  composeFoodCard,
  type FoodCardContent,
  type FoodCardStyle,
} from "../lib/foodCard";

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

// The card renders at its true 1080x1350 so the capture is pixel-exact; it is
// only scaled down visually to fit the modal.
const imgScale = ref(0.3);
const boxWidth = ref(0);
/** Falls back when innerHeight is unavailable or reports 0 (hidden tab). */
function safeViewportH(): number {
  const h = typeof window === "undefined" ? 0 : window.innerHeight;
  return h > 200 ? h : 900;
}

const viewportH = ref(safeViewportH());
let observer: ResizeObserver | null = null;

/**
 * Tallest the preview may be. Scaling on width alone made a 1080x1350 card
 * ~750px tall inside the modal, which pushed the footer buttons off screen and
 * forced the whole dialog to scroll — so the viewport gets a say too. The
 * subtraction leaves room for the dialog header, the edit panel and the footer.
 */
const previewMaxH = computed(() =>
  Math.max(240, Math.min(viewportH.value - 430, 560)),
);

function measure() {
  const box = previewBox.value;
  // Guard the zero case: if the box is measured while it has no laid-out width
  // (hidden tab, first paint), scale(0) would collapse the preview to nothing.
  // Keeping the previous scale is always better than an invisible preview.
  if (!box || box.clientWidth <= 0) return;
  boxWidth.value = box.clientWidth;
  imgScale.value = Math.min(
    box.clientWidth / SKETCH_W,
    previewMaxH.value / SKETCH_H,
  );
}

/** Height the scaled card actually occupies, so the box hugs it exactly. */
const previewHeight = computed(() => Math.round(SKETCH_H * imgScale.value));

/** Centres the scaled card when fitting by height leaves side gutters. */
/** Exposed for the template, which has no access to globals. */
const Math_ = Math;

const previewOffsetX = computed(() =>
  Math.max(0, Math.round((boxWidth.value - SKETCH_W * imgScale.value) / 2)),
);

function onResize() {
  viewportH.value = safeViewportH();
  measure();
}

watch(previewBox, (box) => {
  observer?.disconnect();
  observer = null;
  if (!box) return;
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(box);
});

watch(previewMaxH, measure);

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
    contextFilename(props.context) ||
      (props.context.type === "food-review" ? "food-review" : "summary"),
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

/**
 * The food IMG card is a fixed layout filled from text slots, so it needs no
 * styling prompt — the style buttons replace it.
 */
const isFoodCard = computed(
  () => props.format === "img" && props.context.type === "food-review",
);

const cardStyle = ref<FoodCardStyle>("sketchy");
/** Kept across style switches so changing the look costs no extra AI call. */
const cardContent = ref<FoodCardContent | null>(null);

/** Where the words on the card come from. */
type CardWords = "ai" | "own";
const cardWords = ref<CardWords>("ai");

const CARD_WORD_SOURCES: { key: CardWords; label: string; hint: string }[] = [
  { key: "ai", label: "AI writes it", hint: "A title, tagline and callouts written from your details" },
  { key: "own", label: "My own words", hint: "Taken straight from your description and notes" },
];

/** Which arrangement of the chosen style is on screen. */
const cardVariant = ref(0);

/** Callouts are edited as one comma-separated field. */
const labelsText = ref("");

function syncLabelsFromCard() {
  labelsText.value = (cardContent.value?.labels ?? []).join(", ");
}

/** Replaces the card copy with the review's own wording. */
function useOwnWords() {
  if (props.context.type !== "food-review") return;
  cardWords.value = "own";
  cardContent.value = cardFromReview(props.context);
  syncLabelsFromCard();
  renderCard();
}

function onLabelsInput(value: string) {
  labelsText.value = value;
  if (!cardContent.value) return;
  cardContent.value.labels = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function reset() {
  stage.value = "prompt";
  error.value = null;
  composedHtml.value = "";
  progress.value = "";
  source.value = defaultSource();
  cardContent.value = null;
  labelsText.value = "";
  cardVariant.value = 0;
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
    if (isOpen) {
      window.addEventListener("keydown", onKeydown);
      window.addEventListener("resize", onResize);
      onResize();
    } else {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("resize", onResize);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
  observer?.disconnect();
});

/** Stamp shown down the edge of the editorial layout. */
const cardMeta = computed(() => {
  const ctx = props.context;
  if (ctx.type !== "food-review") return "";
  return (ctx.dateVisit ?? "").slice(0, 10) || ctx.location || "";
});

function renderCard() {
  if (!cardContent.value) return;
  composedHtml.value = composeFoodCard(
    cardStyle.value,
    cardContent.value,
    props.context.imageDataUri,
    cardMeta.value,
    cardVariant.value,
  );
}

// Switching style, stepping the layout, or editing any word re-composes
// locally — none of it calls the model.
watch([cardStyle, cardVariant, cardContent], () => {
  if (cardContent.value && stage.value === "preview") renderCard();
}, { deep: true });

// A different style has its own arrangements, so start from its first one.
watch(cardStyle, () => {
  cardVariant.value = 0;
});

/** Steps to the next arrangement of the current style. Free and instant. */
function shuffleLayout() {
  cardVariant.value = (cardVariant.value + 1) % VARIANTS_PER_STYLE;
}

/** Re-fetches the copy from the model, keeping the current layout. */
async function rewriteWithAi() {
  if (props.context.type !== "food-review") return;
  error.value = null;
  progress.value = "Rewriting the words…";
  const previous = stage.value;
  stage.value = "generating";
  try {
    const { card } = await aiApi.foodCard(props.context);
    cardContent.value = card;
    cardWords.value = "ai";
    syncLabelsFromCard();
    renderCard();
    stage.value = "preview";
  } catch (e) {
    error.value = (e as Error).message;
    stage.value = previous;
  }
}

async function generate() {
  stage.value = "generating";
  error.value = null;
  try {
    if (isFoodCard.value && props.context.type === "food-review") {
      if (cardWords.value === "own") {
        // Straight from the review's own fields — the model is not involved.
        cardContent.value = cardFromReview(props.context);
      } else {
        progress.value = "Writing the card…";
        const { card } = await aiApi.foodCard(props.context);
        cardContent.value = card;
      }
      syncLabelsFromCard();
      renderCard();
      stage.value = "preview";
      return;
    }

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
         ? composeSketchDocument(design.html, props.context.imageDataUri ?? undefined)
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
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
      @click.self="stage !== 'generating' && emit('close')"
    >
      <div
        class="dialog-panel my-auto flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-12px_rgb(15_23_42/0.35)]"
        role="dialog"
        aria-modal="true"
        :aria-label="meta.title"
      >
        <!-- Header -->
        <header
          class="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"
        >
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ meta.title }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">{{ meta.label }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
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

        <!-- The only scrolling region, so the footer buttons stay reachable
             however long the preview and the edit panel get. -->
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <!-- Error -->
          <div
            v-if="error"
            class="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
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
            <!-- Food card: pick a layout instead of describing a style. -->
            <div v-if="isFoodCard">
              <p class="mb-1.5 block text-sm font-medium text-slate-700">
                Where should the words come from?
              </p>
              <div
                class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
                role="radiogroup"
                aria-label="Card wording"
              >
                <button
                  v-for="opt in CARD_WORD_SOURCES"
                  :key="opt.key"
                  type="button"
                  role="radio"
                  :aria-checked="cardWords === opt.key"
                  class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition duration-150"
                  :class="
                    cardWords === opt.key
                      ? 'bg-white text-indigo-700 shadow-[0_1px_2px_rgb(15_23_42/0.10)]'
                      : 'text-slate-500 hover:text-slate-800'
                  "
                  @click="cardWords = opt.key"
                >
                  {{ opt.label }}
                </button>
              </div>
              <p class="mt-2.5 text-xs text-slate-500">
                {{ CARD_WORD_SOURCES.find((o) => o.key === cardWords)?.hint }}
                You can edit every word after this.
              </p>

              <p class="mb-1.5 mt-5 block text-sm font-medium text-slate-700">
                Pick a style
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Card style">
                <button
                  v-for="opt in FOOD_CARD_STYLES"
                  :key="opt.key"
                  type="button"
                  role="radio"
                  :aria-checked="cardStyle === opt.key"
                  class="rounded-xl border px-4 py-3 text-left transition duration-150"
                  :class="
                    cardStyle === opt.key
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                      : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50'
                  "
                  @click="cardStyle = opt.key"
                >
                  <span
                    class="block text-sm font-semibold"
                    :class="cardStyle === opt.key ? 'text-indigo-800' : 'text-slate-800'"
                  >{{ opt.label }}</span>
                  <span class="mt-0.5 block text-xs leading-snug text-slate-500">
                    {{ opt.hint }}
                  </span>
                </button>
              </div>
              <p class="mt-3 text-xs text-slate-500">
                The wording is written from the review's details and your notes. Your
                photo is used as-is — you can switch style after generating without
                spending another AI call.
              </p>
              <p v-if="!context.imageDataUri" class="mt-1 text-xs text-amber-700">
                No photo on this review — the card will use a placeholder. Add one from
                the edit screen for the best result.
              </p>
            </div>

            <!-- Source -->
            <div v-if="!isFoodCard" class="mb-5">
              <p class="mb-1.5 block text-sm font-medium text-slate-700">What should we design?</p>
              <div
                class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
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
                      ? 'bg-white text-indigo-700 shadow-[0_1px_2px_rgb(15_23_42/0.10)]'
                      : 'text-slate-500 hover:text-slate-800'
                  "
                  @click="source = opt.key"
                >
                  {{ opt.label }}
                </button>
              </div>
              <p class="mt-2.5 text-xs text-slate-500">{{ sourceHint }}</p>
              <p v-if="!hasNotes" class="mt-1 text-xs text-slate-400">
                “Use my notes” is unavailable — your notes are empty.
              </p>
              <p v-else-if="!hasSummary" class="mt-1 text-xs text-slate-400">
                “Use AI summary” is unavailable — no summary has been generated yet.
              </p>
            </div>

            <template v-if="!isFoodCard">
              <label
                for="export-prompt"
                class="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Describe the style you want
              </label>
              <textarea
                id="export-prompt"
                v-model="prompt"
                rows="3"
                :placeholder="meta.examples[0]"
                class="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              ></textarea>
              <p class="mt-2 text-xs text-slate-500">{{ meta.hint }}</p>

              <div class="mt-4">
                <p class="mb-1.5 block text-sm font-medium text-slate-700">Try one</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="ex in meta.examples"
                    :key="ex"
                    type="button"
                    class="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition duration-150 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
                    @click="prompt = ex"
                  >
                    {{ ex }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Generating -->
          <div
            v-else-if="stage === 'generating'"
            class="flex flex-col items-center justify-center gap-3 py-20 text-slate-500"
          >
            <svg class="h-7 w-7 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            <p class="text-sm font-medium text-slate-700">{{ progress }}</p>
            <p class="text-xs text-slate-400">
              This can take up to a minute on the free tier.
            </p>
          </div>

          <!-- Preview -->
          <div v-else>
            <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-medium text-slate-700">
                Preview
                <span v-if="isFoodCard" class="ml-1 font-normal text-slate-400">
                  layout {{ cardVariant + 1 }} of {{ VARIANTS_PER_STYLE }}
                </span>
              </p>
              <!-- Re-composed locally, so switching costs no extra AI call. -->
              <div v-if="isFoodCard" class="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                <button
                  v-for="opt in FOOD_CARD_STYLES"
                  :key="opt.key"
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-medium transition"
                  :class="
                    cardStyle === opt.key
                      ? 'bg-white text-indigo-700 shadow-[0_1px_2px_rgb(15_23_42/0.10)]'
                      : 'text-slate-500 hover:text-slate-800'
                  "
                  @click="cardStyle = opt.key"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div
              ref="previewBox"
              class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              :style="
                format === 'img'
                  ? { height: previewHeight + 'px' }
                  : { height: Math_.min(416, previewMaxH) + 'px' }
              "
            >
              <!-- Sandboxed: isolates the generated CSS and blocks any scripts. -->
              <iframe
                ref="frame"
                :srcdoc="composedHtml"
                sandbox="allow-same-origin"
                class="border-0 bg-white"
                :class="format === 'img' ? 'absolute top-0' : 'h-full w-full'"
                :style="
                  format === 'img'
                    ? {
                        width: SKETCH_W + 'px',
                        height: SKETCH_H + 'px',
                        transform: `scale(${imgScale})`,
                        transformOrigin: 'top left',
                        left: previewOffsetX + 'px',
                      }
                    : undefined
                "
                title="Generated preview"
                @load="onFrameLoad"
              ></iframe>
            </div>
            <!-- Edit the words that appear on the card. Every keystroke
                 re-composes the layout locally; nothing calls the model. -->
            <div v-if="isFoodCard && cardContent" class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-slate-700">Words on the card</p>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    @click="useOwnWords"
                  >
                    Reset to my description
                  </button>
                  <span class="text-slate-300">·</span>
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    @click="rewriteWithAi"
                  >
                    Rewrite with AI
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Title</span>
                  <input
                    v-model="cardContent.title"
                    class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">
                    Tagline
                    <span class="font-normal text-slate-400">(short line under the title)</span>
                  </span>
                  <input
                    v-model="cardContent.tagline"
                    class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label class="mt-3 block" v-if="cardStyle === 'sketchy'">
                <span class="mb-1 block text-xs font-medium text-slate-600">
                  Callouts
                  <span class="font-normal text-slate-400">
                    (comma separated, up to 4 — the arrows around the dish)
                  </span>
                </span>
                <input
                  :value="labelsText"
                  placeholder="clear broth, tender meatballs"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  @input="onLabelsInput(($event.target as HTMLInputElement).value)"
                />
              </label>

              <label class="mt-3 block" v-if="cardStyle !== 'search'">
                <span class="mb-1 block text-xs font-medium text-slate-600">
                  Body
                  <span class="font-normal text-slate-400">(a sentence or two)</span>
                </span>
                <textarea
                  v-model="cardContent.body"
                  rows="2"
                  class="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                ></textarea>
              </label>

              <div v-if="cardStyle === 'search'" class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Search line</span>
                  <input
                    v-model="cardContent.query"
                    class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Suggestion</span>
                  <input
                    v-model="cardContent.suggestion"
                    class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <p class="mt-3 text-xs text-slate-400">
                Only the fields the
                <span class="font-medium text-slate-500">{{ cardStyle }}</span>
                layout shows are listed. Changes appear in the preview as you type.
              </p>
            </div>

            <p class="mt-2.5 text-xs text-slate-400">
              Accepting downloads the file to your computer.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <footer
          class="flex flex-none flex-col-reverse gap-2 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end"
        >
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="stage === 'generating' || stage === 'downloading'"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            v-if="stage === 'preview' || stage === 'downloading'"
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="stage === 'downloading'"
            :title="
              isFoodCard
                ? 'Show the next arrangement of this style — no AI call'
                : 'Ask the model for another design'
            "
            @click="isFoodCard ? shuffleLayout() : generate()"
          >
            {{ isFoodCard ? "Regenerate layout" : "Regenerate" }}
          </button>
          <button
            v-if="stage !== 'preview' && stage !== 'downloading'"
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="stage === 'generating' || (!isFoodCard && !sourceAvailable(source))"
            @click="generate"
          >
            {{
              stage === "generating"
                ? "Generating…"
                : isFoodCard && cardWords === "own"
                  ? "Build card"
                  : "Generate"
            }}
          </button>
          <button
            v-else
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
