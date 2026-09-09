<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api, type Summary } from "../api/client";
import { useToast } from "../composables/useToast";
import type { Section } from "../lib/sections";

const props = defineProps<{ summary: Summary; section: Section }>();
const emit = defineEmits<{
  (e: "edit"): void;
  (e: "export"): void;
  (e: "delete"): void;
  (e: "back"): void;
}>();

const { success, error } = useToast();
const tab = ref<"summary" | "notes">("summary");

watch(
  () => props.summary.id,
  () => {
    tab.value = props.summary.aiSummary ? "summary" : "notes";
  },
  { immediate: true },
);

const paragraphs = computed(() =>
  (props.summary.aiSummary ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean),
);

const coverUrl = computed(() =>
  props.summary.coverPrompt
    ? api.ai.imageUrl({
        prompt: props.summary.coverPrompt,
        style: props.summary.coverStyle ?? props.section.defaultStyle,
        seed: props.summary.coverSeed ?? 42,
        w: 768,
        h: 432,
      })
    : null,
);
const coverState = ref<"loading" | "ok" | "err">("loading");
watch(coverUrl, () => (coverState.value = "loading"), { immediate: true });

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function copyText() {
  const s = props.summary;
  const lines = [
    s.headline ?? s.sessionTitle,
    `${s.podcastName} · ${s.sessionTitle}`,
    "",
    s.aiSummary ?? s.content,
    "",
    ...(s.takeaways.length ? [`${props.section.takeawaysLabel}:`, ...s.takeaways.map((t) => `• ${t}`)] : []),
    ...(s.tags.length ? ["", s.tags.map((t) => `#${t}`).join(" ")] : []),
    ...(s.url ? ["", s.url] : []),
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    success("Copied to clipboard");
  } catch {
    error("Clipboard is not available here.");
  }
}

async function share() {
  const s = props.summary;
  const data: ShareData = {
    title: s.headline ?? s.sessionTitle,
    text: [s.podcastName, s.takeaways.slice(0, 3).map((t) => `• ${t}`).join("\n")].join("\n"),
    ...(s.url ? { url: s.url } : {}),
  };
  if (navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      /* cancelled */
    }
  } else {
    await copyText();
  }
}
</script>

<template>
  <article class="detail card">
    <div class="cover" :class="{ 'no-img': !coverUrl }">
      <img
        v-if="coverUrl && coverState !== 'err'"
        :src="coverUrl"
        alt=""
        :class="{ ready: coverState === 'ok' }"
        @load="coverState = 'ok'"
        @error="coverState = 'err'"
      />
      <div v-if="coverUrl && coverState === 'loading'" class="cover-loading">
        <span class="spinner"></span>
        <span>Painting your cover…</span>
      </div>
      <button class="back icon" aria-label="Back to list" @click="emit('back')">←</button>
      <div class="cover-meta">
        <span class="chip">{{ summary.podcastName }}</span>
        <span v-if="summary.mood" class="chip neutral">{{ summary.mood }}</span>
      </div>
    </div>

    <div class="body">
      <h1 class="headline">{{ summary.headline || summary.sessionTitle }}</h1>
      <p v-if="summary.headline && summary.headline !== summary.sessionTitle" class="muted subtitle">
        {{ summary.sessionTitle }}
      </p>
      <p class="muted small meta">
        Updated {{ fmt(summary.updatedAt) }}
        <template v-if="summary.url">
          · <a :href="summary.url" target="_blank" rel="noreferrer">Open link ↗</a>
        </template>
      </p>

      <div v-if="summary.tags.length" class="row wrap tags">
        <span v-for="t in summary.tags" :key="t" class="chip">#{{ t }}</span>
      </div>

      <div v-if="summary.aiSummary" class="seg" role="tablist">
        <button role="tab" :class="{ on: tab === 'summary' }" @click="tab = 'summary'">✨ AI summary</button>
        <button role="tab" :class="{ on: tab === 'notes' }" @click="tab = 'notes'">📝 {{ section.notesLabel }}</button>
      </div>

      <Transition name="fade" mode="out-in">
        <div v-if="tab === 'summary' && summary.aiSummary" key="s" class="stack content">
          <section v-if="summary.takeaways.length" class="takeaways">
            <h3>{{ section.takeawaysLabel }}</h3>
            <ol>
              <li v-for="(t, i) in summary.takeaways" :key="i">
                <span class="num">{{ i + 1 }}</span>
                <span>{{ t }}</span>
              </li>
            </ol>
          </section>

          <section class="prose">
            <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
          </section>

          <section v-if="summary.quotes.length" class="quotes">
            <blockquote v-for="(q, i) in summary.quotes" :key="i">“{{ q }}”</blockquote>
          </section>
        </div>

        <div v-else key="n" class="content">
          <pre v-if="summary.content" class="notes">{{ summary.content }}</pre>
          <div v-else class="nonotes">
            <p class="muted">No notes yet. Add some and generate a summary.</p>
          </div>
        </div>
      </Transition>

      <div class="quick row wrap">
        <button class="sm" @click="copyText">📋 Copy</button>
        <button class="sm" @click="share">↗ Share text</button>
        <button class="sm danger" @click="emit('delete')">🗑 Delete</button>
      </div>
    </div>

    <div class="actionbar">
      <button @click="emit('edit')">✏️ Edit</button>
      <button class="magic" @click="emit('export')">🖼 Export card</button>
    </div>
  </article>
</template>

<style scoped>
.detail {
  overflow: hidden;
}
.cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, var(--brand), var(--brand-2) 60%, var(--brand-3));
  overflow: hidden;
}
.cover.no-img {
  aspect-ratio: auto;
  height: 96px;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.cover img.ready {
  opacity: 1;
}
.cover-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}
.back {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background: rgb(0 0 0 / 0.35);
  color: #fff;
  border-color: transparent;
  backdrop-filter: blur(6px);
}
.back:hover {
  background: rgb(0 0 0 / 0.5);
}
@media (min-width: 840px) {
  .back {
    display: none;
  }
}
.cover-meta {
  position: absolute;
  left: 0.9rem;
  bottom: 0.9rem;
  display: flex;
  gap: 0.4rem;
}
.cover-meta .chip {
  background: rgb(255 255 255 / 0.92);
  color: var(--brand);
  box-shadow: var(--shadow-s);
}
.cover-meta .chip.neutral {
  background: rgb(0 0 0 / 0.45);
  color: #fff;
}
.body {
  padding: 1.1rem 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
@media (min-width: 840px) {
  .body {
    padding: 1.4rem 1.6rem 1.6rem;
  }
}
.headline {
  font-size: clamp(1.35rem, 4.5vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.subtitle {
  margin-top: -0.4rem;
  font-weight: 500;
}
.meta {
  margin-top: -0.3rem;
}
.tags {
  gap: 0.4rem;
}
.content {
  margin-top: 0.25rem;
}
.takeaways h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-bottom: 0.6rem;
}
.takeaways ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.takeaways li {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  background: var(--bg-sunken);
  line-height: 1.45;
  font-weight: 500;
}
.num {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
}
.prose {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  line-height: 1.65;
  font-size: 1rem;
}
.quotes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
blockquote {
  margin: 0;
  padding: 0.85rem 1rem;
  border-left: 4px solid var(--brand-2);
  background: var(--brand-soft);
  border-radius: 0 12px 12px 0;
  font-style: italic;
  line-height: 1.5;
}
.notes {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  line-height: 1.6;
  background: var(--bg-sunken);
  border-radius: 14px;
  padding: 1rem;
}
.nonotes {
  padding: 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  text-align: center;
}
.quick {
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--line);
  margin-top: 0.25rem;
}
</style>
