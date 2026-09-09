<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api, type AuthUser, type Stats, type Summary } from "../api/client";
import { SECTIONS, type Kind } from "../lib/sections";
import Avatar from "./Avatar.vue";

const props = defineProps<{ user: AuthUser | null; refreshKey: number }>();
const emit = defineEmits<{
  (e: "open", item: Summary): void;
  (e: "new", kind: Kind): void;
  (e: "help"): void;
  (e: "account"): void;
}>();

const stats = ref<Stats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    stats.value = await api.stats();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => props.refreshKey, load);

const greeting = computed(() => {
  const h = new Date().getHours();
  const part = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return props.user ? `${part}, ${props.user.username}` : `${part}`;
});

const aiPct = computed(() =>
  stats.value && stats.value.total ? Math.round((stats.value.aiCount / stats.value.total) * 100) : 0,
);

const maxTag = computed(() => Math.max(1, ...(stats.value?.tags.map((t) => t.count) ?? [1])));

function rel(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tiles = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return [
    { label: "Summaries", value: s.total, icon: "📚", hint: `${s.thisWeek} this week` },
    { label: "Podcast", value: s.byKind.podcast ?? 0, icon: "🎙️", hint: "episodes", kind: "podcast" as Kind },
    { label: "Food", value: s.byKind.food ?? 0, icon: "🍜", hint: "dishes", kind: "food" as Kind },
    { label: "AI-written", value: s.aiCount, icon: "✨", hint: `${aiPct.value}% of all` },
    { label: "Key points", value: s.takeaways, icon: "💡", hint: "takeaways saved" },
    { label: "With cover", value: s.withCover, icon: "🖼", hint: "ready to export" },
  ];
});
</script>

<template>
  <section class="dash stack">
    <header class="hello card card-pad">
      <div class="row">
        <Avatar v-if="user" :style="user.avatarStyle" :seed="user.avatarSeed" :name="user.username" :size="52" />
        <span v-else class="hello-ic" aria-hidden="true">👋</span>
        <div class="grow">
          <h1>{{ greeting }}</h1>
          <p class="muted small">
            <template v-if="user">Signed in as {{ user.email }}.</template>
            <template v-else>
              You're a guest: notes stay in this browser.
              <button class="link" @click="emit('account')">Sign in</button> to keep them.
            </template>
          </p>
        </div>
        <button class="icon ghost" title="How to use" aria-label="How to use" @click="emit('help')">❔</button>
      </div>
      <div class="row wrap quick">
        <button class="magic" @click="emit('new', 'podcast')">🎙️ New podcast</button>
        <button @click="emit('new', 'food')">🍜 New food</button>
      </div>
    </header>

    <p v-if="error" class="card card-pad err small">{{ error }}</p>

    <div class="tiles">
      <template v-if="loading && !stats">
        <div v-for="i in 6" :key="i" class="tile card skeleton" style="height: 92px"></div>
      </template>
      <button
        v-for="t in tiles"
        v-else
        :key="t.label"
        type="button"
        class="tile card"
        :class="{ clickable: !!t.kind }"
        :disabled="!t.kind"
        @click="t.kind && emit('new', t.kind)"
      >
        <span class="tile-ic" aria-hidden="true">{{ t.icon }}</span>
        <span class="tile-val">{{ t.value }}</span>
        <span class="tile-label">{{ t.label }}</span>
        <span class="tile-hint muted">{{ t.hint }}</span>
      </button>
    </div>

    <div v-if="stats && stats.total === 0" class="card card-pad empty">
      <div class="empty-art" aria-hidden="true">🚀</div>
      <h2>Nothing here yet</h2>
      <p class="muted">Three steps: jot notes, tap Generate, export a card. Takes about a minute.</p>
      <div class="row wrap">
        <button class="magic" @click="emit('new', 'podcast')">Start with a podcast</button>
        <button class="ghost" @click="emit('help')">Read the guide</button>
      </div>
    </div>

    <div v-else-if="stats" class="grid2">
      <section class="card card-pad">
        <div class="row between head">
          <h2>Recent</h2>
          <span class="small muted" v-if="stats.lastUpdated">updated {{ rel(stats.lastUpdated) }}</span>
        </div>
        <ul class="recent">
          <li v-for="s in stats.recent" :key="s.id">
            <button class="recent-btn" @click="emit('open', s)">
              <span class="kind" aria-hidden="true">{{ SECTIONS[s.kind].icon }}</span>
              <span class="grow txt">
                <span class="title">{{ s.headline || s.sessionTitle }}</span>
                <span class="sub small muted">{{ s.podcastName }} · {{ rel(s.updatedAt) }}</span>
              </span>
              <span v-if="s.aiSummary" title="AI summary" aria-label="AI summary">✨</span>
              <span class="chev" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="card card-pad">
        <div class="row between head">
          <h2>Top tags</h2>
          <span class="small muted">{{ stats.tags.length }} shown</span>
        </div>
        <p v-if="!stats.tags.length" class="muted small">Tags appear after your first AI summary.</p>
        <ul v-else class="tags">
          <li v-for="t in stats.tags" :key="t.tag">
            <span class="tag">#{{ t.tag }}</span>
            <span class="bar"><span class="fill" :style="{ width: (t.count / maxTag) * 100 + '%' }"></span></span>
            <span class="count small muted">{{ t.count }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dash {
  gap: 1rem;
}
.hello {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.hello h1 {
  font-size: clamp(1.15rem, 4vw, 1.5rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}
.hello-ic {
  font-size: 2rem;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-avatar);
  background: var(--brand-soft);
  flex: none;
}
.link {
  all: unset;
  color: var(--brand);
  font-weight: 700;
  cursor: pointer;
}
.quick {
  gap: 0.5rem;
}
.err {
  color: var(--danger);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
@media (min-width: 600px) {
  .tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 1000px) {
  .tiles {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.85rem 0.95rem;
  min-height: 92px;
  text-align: left;
  border-radius: var(--radius);
  font: inherit;
  cursor: default;
  white-space: normal;
}
.tile:disabled {
  opacity: 1;
}
.tile.clickable {
  cursor: pointer;
}
.tile.clickable:hover {
  background: var(--bg-sunken);
}
.tile-ic {
  font-size: 1.1rem;
}
.tile-val {
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-heading);
}
.tile-label {
  font-weight: 700;
  font-size: 0.85rem;
}
.tile-hint {
  font-size: 0.72rem;
}
/* The 8-bit heading font is wide: scale tile type down so labels fit. */
:root[data-theme^="pixel"] .tile-val {
  font-size: 1.25rem;
}
:root[data-theme^="pixel"] .tile-label {
  font-size: 0.55rem;
  font-family: var(--font-heading);
  text-transform: uppercase;
  line-height: 1.4;
  white-space: normal;
}
:root[data-theme^="pixel"] .tile-hint {
  /* the tile is a <button>, so undo the pixel button typography here */
  font-family: var(--font);
  font-size: 0.95rem;
  text-transform: none;
  letter-spacing: 0;
}
:root[data-theme^="pixel"] .hello h1 {
  font-size: 0.9rem !important;
  line-height: 1.5 !important;
}
.empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.25rem 1.25rem;
}
.empty-art {
  font-size: 2.2rem;
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-l);
  background: var(--brand-soft);
}
.empty h2 {
  font-weight: 800;
  font-size: 1.15rem;
}
.empty .row {
  justify-content: center;
  margin-top: 0.4rem;
}
.grid2 {
  display: grid;
  gap: 1rem;
}
@media (min-width: 840px) {
  .grid2 {
    grid-template-columns: 1.3fr 1fr;
    align-items: start;
  }
}
.head {
  margin-bottom: 0.6rem;
}
.head h2 {
  font-size: 1rem;
  font-weight: 800;
}
.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.recent-btn {
  all: unset;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.6rem 0.5rem;
  border-radius: var(--radius-s);
  cursor: pointer;
  font-family: var(--font);
}
.recent-btn:hover {
  background: var(--bg-sunken);
}
.kind {
  font-size: 1.2rem;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  flex: none;
}
.txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.title {
  font-weight: 700;
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chev {
  color: var(--fg-faint);
  font-size: 1.3rem;
}
.tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.tags li {
  display: grid;
  grid-template-columns: minmax(80px, 38%) 1fr auto;
  gap: 0.6rem;
  align-items: center;
}
.tag {
  color: var(--brand);
  font-weight: 700;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  height: 10px;
  background: var(--bg-sunken);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--brand), var(--brand-2));
}
.count {
  font-variant-numeric: tabular-nums;
}
</style>
