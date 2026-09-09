<script setup lang="ts">
import { useToast } from "../composables/useToast";

const { toasts, dismiss } = useToast();
const icon = { info: "💬", success: "✅", error: "⚠️" } as const;
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="pop">
      <button
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="t.kind"
        @click="dismiss(t.id)"
      >
        <span aria-hidden="true">{{ icon[t.kind] }}</span>
        <span class="text">{{ t.text }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(var(--header-h) + var(--safe-t) + 0.6rem);
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  min-height: 0;
  padding: 0.7rem 1rem;
  border-radius: 14px;
  background: var(--fg);
  color: var(--bg);
  border: none;
  box-shadow: var(--shadow);
  font-weight: 500;
  font-size: 0.9rem;
  max-width: 520px;
  width: 100%;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
}
.toast:hover {
  background: var(--fg);
}
.toast.error {
  background: var(--danger);
  color: #fff;
}
.toast.success {
  background: var(--success);
  color: #fff;
}
.text {
  flex: 1;
}
</style>
