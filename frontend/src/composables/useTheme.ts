import { computed, ref, watch } from "vue";

/**
 * Themes: "system" follows the OS, "light" / "dark" force a palette, and
 * "pixel" is a retro 8-bit skin (own font, hard edges, chunky shadows).
 * The value is stamped on <html data-theme> and CSS does the rest.
 */
export type Theme = "system" | "light" | "dark" | "pixel";

export const THEMES: { id: Theme; label: string; icon: string; hint: string }[] = [
  { id: "system", label: "System", icon: "🖥️", hint: "Follow your device" },
  { id: "light", label: "Light", icon: "☀️", hint: "Bright and clean" },
  { id: "dark", label: "Dark", icon: "🌙", hint: "Easy on the eyes" },
  { id: "pixel", label: "Pixel", icon: "👾", hint: "8-bit classic" },
];

const KEY = "summary-hub:theme";

function load(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "pixel" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

const theme = ref<Theme>(load());

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  // Keep the browser chrome colour in step (mobile address bar).
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (bg) meta.content = bg;
  }
}

apply(theme.value);
watch(theme, (t) => {
  apply(t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
});

export function useTheme() {
  const isPixel = computed(() => theme.value === "pixel");
  return { theme, themes: THEMES, isPixel, setTheme: (t: Theme) => (theme.value = t) };
}
