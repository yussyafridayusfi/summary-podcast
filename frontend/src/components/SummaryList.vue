<script setup lang="ts">
import { computed, ref } from "vue";
import type { Summary } from "../api/client";
import type { Section } from "../lib/sections";

const props = defineProps<{
  items: Summary[];
  selectedId: string | null;
  loading: boolean;
  section: Section;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "new"): void;
}>();

const q = ref("");

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return props.items;
  return props.items.filter((it) =>
    [it.sessionTitle, it.podcastName, it.headline ?? "", ...it.tags]
      .join(" ")
      .toLowerCase()
      .includes(s),
  );
});

function relTime(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Deterministic pastel per source so the list feels organised. */
function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
</script>

<template>
  <section class="list card">
    <div class="list-head">
      <div class="row between">
        <h2>My {{ section.label.toLowerCase() }} summaries</h2>
        <span v-if="items.length" class="chip neutral">{{ items.length }}</span>
      </div>
      <div class="search">
        <span class="search-ic" aria-hidden="true">🔍</span>
        <input
          v-model="q"
          type="search"
          :placeholder="`Search ${section.label.toLowerCase()}s, titles, tags…`"
          aria-label="Search summaries"
          enterkeyhint="search"
        />
      </div>
    </div>

    <ul v-if="loading" class="items" aria-busy="true">
      <li v-for="i in 4" :key="i" class="item sk">
        <span class="avatar skeleton"></span>
        <div class="grow stack" style="gap: 0.4rem">
          <span class="skeleton" style="height: 14px; width: 70%">.</span>
          <span class="skeleton" style="height: 11px; width: 45%">.</span>
        </div>
      </li>
    </ul>

    <div v-else-if="items.length === 0" class="empty">
      <div class="empty-art" aria-hidden="true">{{ section.icon }}</div>
      <h3>{{ section.emptyTitle }}</h3>
      <p class="muted small">{{ section.emptyHint }}</p>
      <button class="magic" @click="emit('new')">✨ Create your first</button>
    </div>

    <p v-else-if="filtered.length === 0" class="muted small nores">No matches for “{{ q }}”.</p>

    <ul v-else class="items">
      <li
        v-for="item in filtered"
        :key="item.id"
        class="item"
        :class="{ active: item.id === selectedId }"
      >
        <button class="item-btn" @click="emit('select', item.id)">
          <span
            class="avatar"
            :style="{
              background: `linear-gradient(135deg, hsl(${hue(item.podcastName)} 80% 68%), hsl(${(hue(item.podcastName) + 40) % 360} 85% 60%))`,
            }"
            aria-hidden="true"
            >{{ item.podcastName.trim().slice(0, 1).toUpperCase() }}</span
          >
          <span class="grow txt">
            <span class="title">{{ item.headline || item.sessionTitle }}</span>
            <span class="sub">
              {{ item.podcastName }} · {{ relTime(item.updatedAt) }}
              <span v-if="item.aiSummary" class="ai" title="AI summary">✨</span>
            </span>
            <span v-if="item.tags.length" class="tags">
              <span v-for="t in item.tags.slice(0, 3)" :key="t" class="tag">#{{ t }}</span>
            </span>
          </span>
          <span class="chev" aria-hidden="true">›</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.list {
  overflow: hidden;
}
.list-head {
  padding: 1rem 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.list-head h2 {
  font-size: 1.05rem;
  font-weight: 800;
}
.search {
  position: relative;
}
.search-ic {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  opacity: 0.6;
}
.search input {
  padding-left: 2.4rem;
  border-radius: 999px;
  background: var(--bg-sunken);
  border-color: transparent;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  border-radius: 12px;
}
.item.sk {
  display: flex;
  gap: 0.75rem;
  padding: 0.7rem 0.6rem;
  align-items: center;
}
.item-btn {
  all: unset;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.6rem;
  border-radius: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
  font-family: var(--font);
}
.item-btn:hover {
  background: var(--bg-sunken);
}
.item.active .item-btn {
  background: var(--brand-soft);
}
.avatar {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
}
.txt {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.title {
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.sub {
  font-size: 0.78rem;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai {
  margin-left: 0.2rem;
}
.tags {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}
.tag {
  font-size: 0.7rem;
  color: var(--brand);
  font-weight: 600;
}
.chev {
  color: var(--fg-faint);
  font-size: 1.4rem;
  line-height: 1;
}
@media (min-width: 840px) {
  .chev {
    display: none;
  }
}
.empty {
  text-align: center;
  padding: 2rem 1.25rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.empty-art {
  font-size: 2.8rem;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  border-radius: 28px;
  background: var(--brand-soft);
  margin-bottom: 0.25rem;
}
.empty h3 {
  font-size: 1.05rem;
  font-weight: 800;
}
.empty button {
  margin-top: 0.4rem;
}
.nores {
  padding: 1rem 1rem 1.25rem;
}
</style>
