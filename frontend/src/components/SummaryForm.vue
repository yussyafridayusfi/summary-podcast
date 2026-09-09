<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import {
  api,
  ApiError,
  type AiSummary,
  type ProviderInfo,
  type Summary,
  type SummaryInput,
  type Tone,
} from "../api/client";
import { useToast } from "../composables/useToast";
import type { Section } from "../lib/sections";

const props = defineProps<{
  initial: Summary | null;
  submitting: boolean;
  providers: ProviderInfo | null;
  section: Section;
}>();

const emit = defineEmits<{
  (e: "submit", value: SummaryInput): void;
  (e: "cancel"): void;
}>();

const { success, error } = useToast();

/** Whether the editable AI-result panel is expanded. Declared before the watcher that sets it. */
const aiOpen = ref(false);

const form = reactive<Required<Omit<SummaryInput, "coverSeed" | "coverStyle" | "kind">> & {
  coverStyle: string;
  coverSeed: number | null;
}>({
  podcastName: "",
  sessionTitle: "",
  url: "",
  content: "",
  headline: "",
  aiSummary: "",
  takeaways: [],
  quotes: [],
  tags: [],
  mood: "",
  coverPrompt: "",
  coverStyle: props.section.defaultStyle,
  coverSeed: null,
});

watch(
  () => props.initial,
  (s) => {
    form.podcastName = s?.podcastName ?? "";
    form.sessionTitle = s?.sessionTitle ?? "";
    form.url = s?.url ?? "";
    form.content = s?.content ?? "";
    form.headline = s?.headline ?? "";
    form.aiSummary = s?.aiSummary ?? "";
    form.takeaways = [...(s?.takeaways ?? [])];
    form.quotes = [...(s?.quotes ?? [])];
    form.tags = [...(s?.tags ?? [])];
    form.mood = s?.mood ?? "";
    form.coverPrompt = s?.coverPrompt ?? "";
    form.coverStyle = s?.coverStyle ?? props.section.defaultStyle;
    form.coverSeed = s?.coverSeed ?? null;
    aiOpen.value = !!s?.aiSummary;
  },
  { immediate: true },
);

/* ------------------------------------------------------------------ AI */
const tone = ref<Tone>("playful");
const language = ref<"" | "en" | "id">("");
const generating = ref(false);
const aiMeta = ref<{ provider: string; model: string; usedUrl: boolean } | null>(null);
const newTakeaway = ref("");
const newTag = ref("");

const canGenerate = computed(
  () =>
    !!form.podcastName.trim() &&
    !!form.sessionTitle.trim() &&
    (form.content.trim().length > 20 || !!form.url?.trim()),
);

const primaryText = computed(() => props.providers?.text.find((p) => p.primary));
const needsKey = computed(() => props.providers?.needsKey ?? false);
const isDemo = computed(() => props.providers?.demo ?? false);

const FUN = computed(() =>
  props.section.id === "food"
    ? [
        "Tasting every word…",
        "Plating the highlights…",
        "Sprinkling in flavour notes…",
        "Picking colours for your cover…",
        "Almost there, garnishing ✨",
      ]
    : [
        "Listening back to the episode…",
        "Hunting for the juiciest takeaways…",
        "Polishing quotes…",
        "Picking colours for your cover…",
        "Almost there, adding sparkle ✨",
      ],
);
const funIdx = ref(0);
let funTimer: number | undefined;
function startFun() {
  funIdx.value = 0;
  funTimer = window.setInterval(() => (funIdx.value = (funIdx.value + 1) % FUN.value.length), 2200);
}
function stopFun() {
  if (funTimer) clearInterval(funTimer);
}
onBeforeUnmount(stopFun);

async function generate() {
  if (!canGenerate.value || generating.value) return;
  generating.value = true;
  startFun();
  try {
    const out: AiSummary = await api.ai.summarize({
      kind: props.section.id,
      podcastName: form.podcastName.trim(),
      sessionTitle: form.sessionTitle.trim(),
      notes: form.content,
      url: form.url?.trim() || null,
      tone: tone.value,
      language: language.value || undefined,
    });
    form.headline = out.headline;
    form.aiSummary = out.summary;
    form.takeaways = out.takeaways;
    form.quotes = out.quotes;
    form.tags = out.tags;
    form.mood = out.mood;
    form.coverPrompt = out.coverPrompt;
    form.coverStyle = out.suggestedStyle;
    if (form.coverSeed == null) form.coverSeed = Math.floor(Math.random() * 1_000_000);
    aiMeta.value = { provider: out.provider, model: out.model, usedUrl: out.usedUrl };
    aiOpen.value = true;
    success("Summary generated. Review and save.");
  } catch (e) {
    error(e instanceof ApiError ? e.message : "Generation failed");
  } finally {
    generating.value = false;
    stopFun();
  }
}

function addTakeaway() {
  const t = newTakeaway.value.trim();
  if (!t) return;
  form.takeaways.push(t);
  newTakeaway.value = "";
}
function addTag() {
  const t = newTag.value.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
  if (!t || form.tags.includes(t)) return (newTag.value = "");
  form.tags.push(t);
  newTag.value = "";
}
function clearAi() {
  form.headline = "";
  form.aiSummary = "";
  form.takeaways = [];
  form.quotes = [];
  form.tags = [];
  form.mood = "";
  form.coverPrompt = "";
  aiMeta.value = null;
  aiOpen.value = false;
}

function onSubmit() {
  if (!form.podcastName.trim() || !form.sessionTitle.trim()) return;
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  emit("submit", {
    kind: props.section.id,
    podcastName: form.podcastName.trim(),
    sessionTitle: form.sessionTitle.trim(),
    url: nz(form.url ?? ""),
    content: form.content ?? "",
    headline: nz(form.headline ?? ""),
    aiSummary: nz(form.aiSummary ?? ""),
    takeaways: form.takeaways.map((t) => t.trim()).filter(Boolean),
    quotes: form.quotes.map((t) => t.trim()).filter(Boolean),
    tags: form.tags,
    mood: nz(form.mood ?? ""),
    coverPrompt: nz(form.coverPrompt ?? ""),
    coverStyle: form.coverStyle,
    coverSeed: form.coverSeed,
  });
}
</script>

<template>
  <section class="form card card-pad">
    <header class="row between head">
      <div class="row">
        <button class="icon ghost back" aria-label="Back" @click="emit('cancel')">←</button>
        <h2>{{ initial ? `Edit ${section.label.toLowerCase()} summary` : `New ${section.label.toLowerCase()} summary` }}</h2>
      </div>
    </header>

    <form @submit.prevent="onSubmit" class="stack">
      <div class="grid2">
        <div class="field">
          <label for="podcast">{{ section.fieldA }} *</label>
          <input
            id="podcast"
            v-model="form.podcastName"
            required
            :placeholder="section.fieldAPlaceholder"
            autocomplete="off"
            enterkeyhint="next"
          />
        </div>
        <div class="field">
          <label for="session">{{ section.fieldB }} *</label>
          <input
            id="session"
            v-model="form.sessionTitle"
            required
            :placeholder="section.fieldBPlaceholder"
            autocomplete="off"
            enterkeyhint="next"
          />
        </div>
      </div>

      <div class="field">
        <label for="url">{{ section.urlLabel }}</label>
        <input
          id="url"
          v-model="form.url"
          type="url"
          inputmode="url"
          placeholder="https://… (used as extra context for AI)"
        />
      </div>

      <div class="field">
        <div class="row between">
          <label for="content">{{ section.notesLabel }}</label>
          <span class="small muted">{{ form.content.length.toLocaleString() }} chars</span>
        </div>
        <textarea id="content" v-model="form.content" :placeholder="section.notesPlaceholder" />
      </div>

      <!-- AI panel -->
      <div class="ai-panel">
        <div class="ai-head">
          <div class="grow">
            <div class="row wrap">
              <strong>✨ Generate with AI</strong>
              <span
                v-if="primaryText"
                class="chip small-chip"
                :class="isDemo ? 'success' : 'neutral'"
                :title="primaryText.note"
              >
                {{ primaryText.label }}
              </span>
            </div>
            <p class="small muted">
              Turns your notes into a headline, {{ section.takeawaysLabel.toLowerCase() }}, tags and a cover illustration prompt.
            </p>
          </div>
        </div>

        <div v-if="needsKey" class="notice">
          <strong>Add a free API key to unlock real AI summaries.</strong>
          <p class="small">
            The anonymous fallback only handles tiny prompts. Grab a free key from
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq</a> or
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>,
            put it in <code>backend/.env</code> as <code>GROQ_API_KEY</code> or <code>GEMINI_API_KEY</code>, and restart the API.
          </p>
        </div>
        <div v-else-if="isDemo" class="notice demo">
          <strong>Demo mode.</strong>
          <span class="small">Summaries are stitched from your notes without a model. Add a free key for the real thing.</span>
        </div>

        <div class="row wrap opts">
          <div class="seg" role="radiogroup" aria-label="Tone">
            <button type="button" :class="{ on: tone === 'playful' }" @click="tone = 'playful'">🎈 Playful</button>
            <button type="button" :class="{ on: tone === 'casual' }" @click="tone = 'casual'">☕ Casual</button>
            <button type="button" :class="{ on: tone === 'professional' }" @click="tone = 'professional'">💼 Pro</button>
          </div>
          <div class="seg" role="radiogroup" aria-label="Language">
            <button type="button" :class="{ on: language === '' }" @click="language = ''">Auto</button>
            <button type="button" :class="{ on: language === 'en' }" @click="language = 'en'">EN</button>
            <button type="button" :class="{ on: language === 'id' }" @click="language = 'id'">ID</button>
          </div>
        </div>

        <button
          type="button"
          class="magic gen"
          :disabled="!canGenerate || generating"
          @click="generate"
        >
          <span v-if="generating" class="spinner"></span>
          <span v-if="generating">{{ FUN[funIdx] }}</span>
          <span v-else>{{ form.aiSummary ? "🔁 Regenerate" : "✨ Generate summary" }}</span>
        </button>
        <p v-if="!canGenerate" class="small muted hint">
          Add {{ section.fieldA.toLowerCase() }}, {{ section.fieldB.toLowerCase() }}, and a few lines of notes (or a link) to enable.
        </p>
        <p v-else-if="aiMeta" class="small muted hint">
          Generated by {{ aiMeta.provider }} · {{ aiMeta.model }}
          <span v-if="aiMeta.usedUrl">· used the link for context</span>
        </p>
      </div>

      <!-- AI results (editable) -->
      <Transition name="pop">
        <div v-if="aiOpen" class="ai-result stack">
          <div class="row between">
            <h3>Review &amp; tweak</h3>
            <button type="button" class="sm ghost" @click="clearAi">Clear AI fields</button>
          </div>

          <div class="field">
            <label for="headline">Headline</label>
            <input id="headline" v-model="form.headline" maxlength="120" />
          </div>

          <div class="field">
            <label>{{ section.takeawaysLabel }}</label>
            <ul class="editlist">
              <li v-for="(t, i) in form.takeaways" :key="i">
                <span class="num">{{ i + 1 }}</span>
                <input v-model="form.takeaways[i]" aria-label="Takeaway" />
                <button type="button" class="icon ghost" aria-label="Remove" @click="form.takeaways.splice(i, 1)">✕</button>
              </li>
            </ul>
            <div class="row">
              <input
                v-model="newTakeaway"
                placeholder="Add one…"
                enterkeyhint="done"
                @keydown.enter.prevent="addTakeaway"
              />
              <button type="button" class="sm" @click="addTakeaway">Add</button>
            </div>
          </div>

          <div class="field">
            <label for="aisummary">Summary</label>
            <textarea id="aisummary" v-model="form.aiSummary" style="min-height: 11rem" />
          </div>

          <div class="field">
            <label>Tags</label>
            <div class="row wrap">
              <span v-for="(t, i) in form.tags" :key="t" class="chip">
                #{{ t }}
                <button type="button" class="chip-x" aria-label="Remove tag" @click="form.tags.splice(i, 1)">✕</button>
              </span>
              <input
                v-model="newTag"
                class="tag-input"
                placeholder="+ tag"
                enterkeyhint="done"
                @keydown.enter.prevent="addTag"
                @blur="addTag"
              />
            </div>
          </div>

          <div class="grid2">
            <div class="field">
              <label for="mood">Mood</label>
              <input id="mood" v-model="form.mood" maxlength="40" placeholder="cozy, energetic…" />
            </div>
            <div class="field">
              <label for="style">Cover style</label>
              <select id="style" v-model="form.coverStyle">
                <option v-for="s in providers?.styles ?? []" :key="s.id" :value="s.id">
                  {{ s.emoji }} {{ s.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="field">
            <label for="cover">Cover illustration prompt</label>
            <textarea
              id="cover"
              v-model="form.coverPrompt"
              style="min-height: 4.5rem"
              placeholder="Describe the picture: objects, scene, colors (English works best)"
            />
          </div>
        </div>
      </Transition>

      <div class="actionbar form-actions">
        <button type="button" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="primary" :disabled="submitting || generating">
          <span v-if="submitting" class="spinner"></span>
          {{ submitting ? "Saving…" : initial ? "Save changes" : "Create summary" }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.head {
  margin-bottom: 1rem;
}
.head h2 {
  font-size: 1.15rem;
  font-weight: 800;
}
.back {
  margin-left: -0.6rem;
}
@media (min-width: 840px) {
  .back {
    display: none;
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.grid2 {
  display: grid;
  gap: 0.75rem;
}
@media (min-width: 600px) {
  .grid2 {
    grid-template-columns: 1fr 1fr;
  }
}
.ai-panel {
  border-radius: var(--radius);
  padding: 1rem;
  background:
    radial-gradient(120% 140% at 0% 0%, rgb(109 74 255 / 0.12), transparent 60%),
    radial-gradient(120% 140% at 100% 100%, rgb(255 107 203 / 0.14), transparent 60%),
    var(--bg-sunken);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.ai-head strong {
  font-size: 1rem;
}
.small-chip {
  font-size: 0.68rem;
  padding: 0.15rem 0.5rem;
}
.notice {
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  background: var(--brand-soft);
  border: 1px solid color-mix(in srgb, var(--brand) 30%, transparent);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  line-height: 1.45;
}
.notice.demo {
  background: var(--success-soft);
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: baseline;
}
.notice code {
  font-size: 0.8em;
  background: rgb(0 0 0 / 0.08);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}
.opts {
  gap: 0.5rem;
}
.gen {
  width: 100%;
  min-height: 50px;
  font-size: 1rem;
}
.hint {
  margin-top: -0.3rem;
  text-align: center;
}
.ai-result {
  border-radius: var(--radius);
  border: 1px solid var(--line);
  padding: 1rem;
  gap: 0.9rem;
}
.ai-result h3 {
  font-size: 0.95rem;
  font-weight: 800;
}
.editlist {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.editlist li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.editlist .icon {
  width: 38px;
  min-height: 38px;
  flex: none;
}
.num {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}
.chip-x {
  all: unset;
  cursor: pointer;
  margin-left: 0.15rem;
  font-size: 0.7rem;
  opacity: 0.7;
  padding: 0.1rem 0.2rem;
}
.tag-input {
  width: auto;
  min-width: 80px;
  flex: 1;
  min-height: 34px;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
.form-actions {
  margin-top: 0.25rem;
}
</style>
