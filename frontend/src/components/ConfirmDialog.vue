<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as a destructive action instead of primary. */
  danger?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("cancel");
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-4 backdrop-blur-[2px] sm:items-center"
        @click.self="emit('cancel')"
      >
        <div
          class="dialog-panel w-full max-w-md rounded-2xl border border-line-soft bg-surface p-6 shadow-[0_18px_50px_-12px_rgb(33_31_28/0.3)] sm:p-7"
          role="alertdialog"
          aria-modal="true"
          :aria-label="title"
        >
          <h2 class="font-serif text-title text-ink">{{ title }}</h2>
          <p v-if="message" class="mt-2.5 text-sm leading-relaxed text-ink-muted">
            {{ message }}
          </p>
          <div
            class="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <button type="button" class="btn btn-quiet" @click="emit('cancel')">
              {{ cancelText ?? "Cancel" }}
            </button>
            <button
              type="button"
              class="btn"
              :class="danger ? 'btn-danger' : 'btn-primary'"
              @click="emit('confirm')"
            >
              {{ confirmText ?? "Confirm" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 180ms ease;
}
.dialog-enter-active .dialog-panel,
.dialog-leave-active .dialog-panel {
  transition:
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
