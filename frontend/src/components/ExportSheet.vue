<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { api, type ProviderInfo, type Summary } from "../api/client";
import { useToast } from "../composables/useToast";
import { ASPECTS, canvasToBlob, loadImage, renderCard, slug, type Aspect } from "../lib/card";
import type { Section } from "../lib/sections";
import BottomSheet from "./BottomSheet.vue";

const props = defineProps<{
  open: boolean;
  summary: Summary | null;
  providers: ProviderInfo | null;
  section: Section;
}>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "saveCover", payload: { coverStyle: string; coverSeed: number }): void;
}>();

const { success, error } = useToast();

const canvas = ref<HTMLCanvasElement | null>(null);
const aspect = ref<Aspect>("square");
const style = ref("playful");
const seed = ref(42);
const showImage = ref(true);
const footer = ref(props.section.cardFooter);
watch(() => props.section.id, () => (footer.value = props.section.cardFooter));
const loading = ref(false);
const imgError = ref<string | null>(null);
const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare;

let currentImg: HTMLImageElement | null = null;
let loadToken = 0;

const styles = computed(
  () =>
    props.providers?.styles ?? [
      { id: "playful", label: "Playful", emoji: "🎈" },
      { id: "doodle", label: "Doodle", emoji: "✏️" },
      { id: "retro", label: "Retro", emoji: "📻" },
      { id: "neon", label: "Neon", emoji: "🌃" },
      { id: "paper", label: "Papercut", emoji: "🎨" },
      { id: "minimal", label: "Minimal", emoji: "⚪" },
    ],
);

const subject = computed(
  () =>
    props.summary?.coverPrompt ||
    (props.section.id === "food"
      ? `a beautifully plated ${props.summary?.sessionTitle ?? "dish"} on a wooden table with steam and fresh herbs`
      : `a cheerful podcast microphone with headphones and sound waves, about ${props.summary?.sessionTitle ?? "an episode"}`),
);

const imageProvider = computed(() => props.providers?.image.find((p) => p.primary));

function imageDims() {
  // Ask the model for the card's aspect so the picture composes well.
  const a = ASPECTS[aspect.value];
  const scale = 1024 / Math.max(a.w, a.h);
  return { w: Math.round(a.w * scale), h: Math.round(a.h * scale) };
}

function draw() {
  const c = canvas.value;
  const s = props.summary;
  if (!c || !s) return;
  renderCard(c, {
    aspect: aspect.value,
    style: style.value,
    image: showImage.value ? currentImg : null,
    data: {
      podcastName: s.podcastName,
      headline: s.headline || s.sessionTitle,
      takeaways: s.takeaways,
      tags: s.tags,
      mood: s.mood,
      footer: footer.value,
      badge: props.section.cardBadge,
    },
  });
}

async function refreshImage() {
  if (!props.summary) return;
  const token = ++loadToken;
  imgError.value = null;
  if (!showImage.value) {
    currentImg = null;
    draw();
    return;
  }
  loading.value = true;
  draw(); // show typography immediately over the gradient
  const { w, h } = imageDims();
  try {
    const img = await loadImage(
      api.ai.imageUrl({ prompt: subject.value, style: style.value, seed: seed.value, w, h }),
    );
    if (token !== loadToken) return;
    currentImg = img;
    draw();
  } catch (e) {
    if (token !== loadToken) return;
    currentImg = null;
    imgError.value = (e as Error).message;
    draw();
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function shuffle() {
  seed.value = Math.floor(Math.random() * 1_000_000);
}

watch(
  () => props.open,
  async (o) => {
    if (!o || !props.summary) return;
    style.value = props.summary.coverStyle ?? props.section.defaultStyle;
    seed.value = props.summary.coverSeed ?? 42;
    await nextTick();
    refreshImage();
  },
);
watch([style, seed, aspect, showImage], () => props.open && refreshImage());
watch(footer, () => props.open && draw());
onMounted(() => props.open && refreshImage());

function fileName(ext: string) {
  const s = props.summary;
  return `${slug(s?.podcastName ?? "podcast")}-${slug(s?.headline || s?.sessionTitle || "summary")}-${aspect.value}.${ext}`;
}

async function download() {
  const c = canvas.value;
  if (!c) return;
  try {
    const blob = await canvasToBlob(c);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName("png");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    success("Card downloaded");
  } catch (e) {
    error((e as Error).message);
  }
}

async function shareImage() {
  const c = canvas.value;
  if (!c) return;
  try {
    const blob = await canvasToBlob(c);
    const file = new File([blob], fileName("png"), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: props.summary?.headline ?? props.summary?.sessionTitle,
      });
    } else {
      await download();
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") error((e as Error).message);
  }
}

async function copyImage() {
  const c = canvas.value;
  if (!c) return;
  try {
    const blob = await canvasToBlob(c);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    success("Image copied to clipboard");
  } catch {
    error("Copying images is not supported here. Use Download instead.");
  }
}

function saveCover() {
  emit("saveCover", { coverStyle: style.value, coverSeed: seed.value });
}
</script>

<template>
  <BottomSheet :open="open" title="Export share card" wide @close="emit('close')">
    <div class="export">
      <div class="preview" :class="aspect">
        <canvas ref="canvas" aria-label="Share card preview"></canvas>
        <Transition name="fade">
          <div v-if="loading" class="preview-badge">
            <span class="spinner"></span> Generating illustration…
          </div>
        </Transition>
        <div v-if="imgError" class="preview-badge err">
          {{ imgError }} Showing gradient background instead.
        </div>
      </div>

      <div class="controls stack">
        <div class="ctl">
          <label>Format</label>
          <div class="seg">
            <button
              v-for="(a, id) in ASPECTS"
              :key="id"
              type="button"
              :class="{ on: aspect === id }"
              :title="a.hint"
              @click="aspect = id as Aspect"
            >
              {{ a.label }}
            </button>
          </div>
        </div>

        <div class="ctl">
          <div class="row between">
            <label>Illustration style</label>
            <label class="toggle">
              <input v-model="showImage" type="checkbox" />
              <span>AI image</span>
            </label>
          </div>
          <div class="styles">
            <button
              v-for="s in styles"
              :key="s.id"
              type="button"
              class="style"
              :class="{ on: style === s.id }"
              :disabled="!showImage"
              @click="style = s.id"
            >
              <span class="emoji">{{ s.emoji }}</span>
              <span>{{ s.label }}</span>
            </button>
          </div>
        </div>

        <div class="ctl">
          <label>Variation</label>
          <div class="row">
            <button type="button" class="grow" :disabled="!showImage || loading" @click="shuffle">
              🎲 Shuffle illustration
            </button>
            <span class="chip neutral" title="Seed">#{{ seed }}</span>
          </div>
          <p class="small muted">
            Powered by {{ imageProvider?.label ?? "Pollinations" }} (free).
            <span v-if="imageProvider?.id === 'pollinations'">Same seed always gives the same picture.</span>
          </p>
        </div>

        <div class="ctl">
          <label for="footer">Footer text</label>
          <input id="footer" v-model="footer" maxlength="60" />
        </div>

        <button type="button" class="sm ghost" @click="saveCover">
          💾 Remember this style &amp; seed as the cover
        </button>
      </div>
    </div>

    <template #footer>
      <button type="button" @click="copyImage">📋 Copy</button>
      <button v-if="canShareFiles" type="button" @click="shareImage">↗ Share</button>
      <button type="button" class="primary" @click="download">⬇ Download PNG</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.export {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 840px) {
  .export {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    align-items: start;
  }
}
.preview {
  position: relative;
  width: 100%;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-sunken);
  box-shadow: var(--shadow);
  display: flex;
  justify-content: center;
}
.preview canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(70dvh, 620px);
  object-fit: contain;
}
.preview.story canvas {
  width: auto;
  max-width: 100%;
}
.preview-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  backdrop-filter: blur(6px);
}
.preview-badge.err {
  background: var(--danger);
  top: auto;
  bottom: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  border-radius: 12px;
  text-align: center;
}
.controls {
  gap: 1rem;
}
.ctl {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}
.toggle input {
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  accent-color: var(--brand);
}
.styles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}
.style {
  flex-direction: column;
  gap: 0.15rem;
  min-height: 64px;
  border-radius: 14px;
  font-size: 0.8rem;
  padding: 0.5rem;
}
.style .emoji {
  font-size: 1.35rem;
}
.style.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: 0 0 0 3px rgb(109 74 255 / 0.15);
}
</style>
