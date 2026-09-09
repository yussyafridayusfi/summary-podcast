<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title?: string;
  /** Max width on desktop where it renders as a centered dialog. */
  wide?: boolean;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const panel = ref<HTMLElement | null>(null);

// Swipe-down to dismiss on touch devices.
let startY = 0;
let dy = 0;
function onTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY;
  dy = 0;
}
function onTouchMove(e: TouchEvent) {
  const el = panel.value;
  if (!el) return;
  // Only when the sheet's own scroll is at top.
  const scroller = el.querySelector<HTMLElement>(".sheet-body");
  if (scroller && scroller.scrollTop > 0) return;
  dy = Math.max(0, e.touches[0].clientY - startY);
  el.style.transform = `translateY(${dy}px)`;
  el.style.transition = "none";
}
function onTouchEnd() {
  const el = panel.value;
  if (!el) return;
  el.style.transition = "";
  if (dy > 110) emit("close");
  el.style.transform = "";
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) emit("close");
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

watch(
  () => props.open,
  (o) => {
    document.body.style.overflow = o ? "hidden" : "";
  },
  { immediate: true },
);
onBeforeUnmount(() => (document.body.style.overflow = ""));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="backdrop" @click.self="emit('close')">
        <Transition name="sheet" appear>
          <section
            ref="panel"
            class="sheet"
            :class="{ wide }"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            @touchstart.passive="onTouchStart"
            @touchmove.passive="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div class="grab" aria-hidden="true"></div>
            <header v-if="title || $slots.header" class="sheet-head">
              <slot name="header">
                <h2>{{ title }}</h2>
              </slot>
              <button class="icon ghost" aria-label="Close" @click="emit('close')">✕</button>
            </header>
            <div class="sheet-body">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="sheet-foot">
              <slot name="footer" />
            </footer>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(10 8 25 / 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-height: calc(100dvh - 3rem);
  background: var(--bg-elev);
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  box-shadow: var(--shadow-l);
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-b);
}
.grab {
  width: 44px;
  height: 5px;
  border-radius: 3px;
  background: var(--line-strong);
  margin: 0.6rem auto 0;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 1rem 0.6rem 1.25rem;
}
.sheet-head h2 {
  font-size: 1.1rem;
  font-weight: 800;
}
.sheet-body {
  overflow: auto;
  padding: 0.25rem 1.25rem 1.25rem;
  -webkit-overflow-scrolling: touch;
}
.sheet-foot {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 0.6rem;
}
.sheet-foot :deep(button) {
  flex: 1;
}

@media (min-width: 840px) {
  .backdrop {
    align-items: center;
    padding: 2rem;
  }
  .sheet {
    max-width: 560px;
    border-radius: var(--radius-l);
    max-height: calc(100dvh - 4rem);
  }
  .sheet.wide {
    max-width: 960px;
  }
  .grab {
    display: none;
  }
  .sheet-head {
    padding-top: 1rem;
  }
  .sheet-foot :deep(button) {
    flex: 0 0 auto;
  }
  .sheet-foot {
    justify-content: flex-end;
  }
}
</style>
