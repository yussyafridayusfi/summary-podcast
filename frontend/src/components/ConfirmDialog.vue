<script setup lang="ts">
import BottomSheet from "./BottomSheet.vue";

defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}>();
const emit = defineEmits<{ (e: "confirm"): void; (e: "cancel"): void }>();
</script>

<template>
  <BottomSheet :open="open" :title="title" @close="emit('cancel')">
    <p class="muted">{{ message }}</p>
    <template #footer>
      <button @click="emit('cancel')">Cancel</button>
      <button :class="danger ? 'danger' : 'primary'" @click="emit('confirm')">
        {{ confirmLabel ?? "Confirm" }}
      </button>
    </template>
  </BottomSheet>
</template>
