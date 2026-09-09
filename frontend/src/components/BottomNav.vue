<script setup lang="ts">
import type { AuthUser } from "../api/client";
import { SECTION_LIST, type Kind } from "../lib/sections";
import Avatar from "./Avatar.vue";

defineProps<{
  /** Active section when `view` is "summaries". */
  kind: Kind;
  view: "dashboard" | "summaries";
  user: AuthUser | null;
}>();
const emit = defineEmits<{
  (e: "select", kind: Kind): void;
  (e: "home"): void;
  (e: "account"): void;
}>();
</script>

<template>
  <nav class="bottomnav" aria-label="Main">
    <button
      type="button"
      class="tab"
      :class="{ on: view === 'dashboard' }"
      :aria-current="view === 'dashboard' ? 'page' : undefined"
      @click="emit('home')"
    >
      <span class="ic" aria-hidden="true">🏠</span>
      <span>Home</span>
    </button>
    <button
      v-for="s in SECTION_LIST"
      :key="s.id"
      type="button"
      class="tab"
      :class="{ on: view === 'summaries' && kind === s.id }"
      :aria-current="view === 'summaries' && kind === s.id ? 'page' : undefined"
      @click="emit('select', s.id)"
    >
      <span class="ic" aria-hidden="true">{{ s.icon }}</span>
      <span>{{ s.label }}</span>
    </button>
    <button type="button" class="tab" @click="emit('account')">
      <Avatar v-if="user" :style="user.avatarStyle" :seed="user.avatarSeed" :name="user.username" :size="26" />
      <span v-else class="ic" aria-hidden="true">👤</span>
      <span>{{ user ? user.username : "Account" }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottomnav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 14;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  padding: 0.35rem 0.5rem calc(0.35rem + var(--safe-b));
  background: color-mix(in srgb, var(--bg-elev) 90%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: var(--border-w) solid var(--line);
}
.tab {
  all: unset;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: 0.25rem;
  border-radius: var(--radius-s);
  font-size: 0.7rem;
  font-weight: 600;
  font-family: var(--font-heading);
  color: var(--fg-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:root[data-theme^="pixel"] .tab {
  font-size: 0.5rem;
}
.tab:active {
  transform: scale(0.96);
}
.tab.on {
  color: var(--brand);
  background: var(--brand-soft);
}
.ic {
  font-size: 1.35rem;
  line-height: 1;
}
@media (min-width: 840px) {
  .bottomnav {
    display: none;
  }
}
</style>
