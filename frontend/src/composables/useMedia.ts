import { onBeforeUnmount, ref } from "vue";

/** Reactive `matchMedia` helper. */
export function useMedia(query: string) {
  const mq = window.matchMedia(query);
  const matches = ref(mq.matches);
  const handler = (e: MediaQueryListEvent) => (matches.value = e.matches);
  mq.addEventListener("change", handler);
  onBeforeUnmount(() => mq.removeEventListener("change", handler));
  return matches;
}

export const DESKTOP_QUERY = "(min-width: 840px)";
