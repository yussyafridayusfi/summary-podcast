<script setup lang="ts">
import type { Summary } from "../api/client";

defineProps<{
  items: Summary[];
  selectedId: string | null;
  loading: boolean;
}>();

defineEmits<{
  (e: "select", id: string): void;
  (e: "new"): void;
}>();
</script>

<template>
  <section class="list">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>My summaries</h2>
      <button class="primary" @click="$emit('new')">+ New</button>
    </div>
    <p v-if="loading" class="meta">Loading…</p>
    <p v-else-if="items.length === 0" class="meta">
      No summaries yet. Click <strong>+ New</strong> to add one.
    </p>
    <ul v-else>
      <li
        v-for="item in items"
        :key="item.id"
        :class="{ active: item.id === selectedId }"
        @click="$emit('select', item.id)"
      >
        <span class="title">{{ item.sessionTitle }}</span>
        <span class="sub">{{ item.podcastName }}</span>
      </li>
    </ul>
  </section>
</template>
