<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { avatarUrl } from "../lib/avatar";

const props = withDefaults(
  defineProps<{
    style: string;
    seed: string;
    name?: string;
    size?: number;
  }>(),
  { size: 36, name: "" },
);

const src = computed(() => avatarUrl(props.style, props.seed, props.size * 2));
const failed = ref(false);
watch(src, () => (failed.value = false));
const initial = computed(() => (props.name?.trim().slice(0, 1) || "?").toUpperCase());
</script>

<template>
  <span
    class="avatar"
    :class="{ ai: style === 'ai' }"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.42 + 'px' }"
    :title="name"
  >
    <img v-if="!failed" :src="src" :alt="name ? `${name}'s avatar` : 'avatar'" @error="failed = true" />
    <span v-else aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-avatar, 40%);
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  color: #fff;
  font-weight: 800;
  overflow: hidden;
  flex: none;
  box-shadow: var(--shadow-s);
}
.avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  background: var(--bg-sunken);
}
.avatar.ai img {
  image-rendering: auto;
}
</style>
