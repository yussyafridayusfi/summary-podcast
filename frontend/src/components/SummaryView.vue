<script setup lang="ts">
import type { Summary } from "../api/client";

defineProps<{ summary: Summary }>();
defineEmits<{ (e: "edit"): void }>();
</script>

<template>
  <section class="detail">
    <h2>{{ summary.sessionTitle }}</h2>
    <p class="meta">
      <strong>{{ summary.podcastName }}</strong>
      <span v-if="summary.url">
        · <a :href="summary.url" target="_blank" rel="noreferrer">open</a>
      </span>
    </p>
    <p class="meta">
      Created {{ new Date(summary.createdAt).toLocaleString() }} ·
      updated {{ new Date(summary.updatedAt).toLocaleString() }}
    </p>
    <div v-if="summary.content" class="content">{{ summary.content }}</div>
    <p v-else class="meta">No notes yet.</p>
    <div class="form-actions">
      <button class="primary" @click="$emit('edit')">Edit</button>
    </div>
  </section>
</template>
