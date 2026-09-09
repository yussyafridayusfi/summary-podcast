import { computed, ref, watch } from "vue";

/**
 * Themes are stamped on <html data-theme> and CSS does the rest.
 *  - "pixel"      light retro 8-bit skin (default)
 *  - "pixel-dark" the same skin on a CRT-navy palette
 *  - "light" / "dark" modern flat palettes
 *  - "system"     modern palette following the OS setting
 */
export type Theme = "pixel" | "pixel-dark" | "light" | "dark" | "system";

export const DEFAULT_THEME: Theme = "pixel";

export const THEMES: { id: Theme; label: string; icon: string; hint: string }[] = [
  { id: "pixel", label: "Pixel", icon: "👾", hint: "8-bit classic, light (default)" },
  { id: "pixel-dark", label: "Pixel Dark", icon: "🕹️", hint: "8-bit on a CRT-navy screen" },
  { id: "light", label: "Light", icon: "☀️", hint: "Modern, bright and clean" },
  { id: "dark", label: "Dark", icon: "🌙", hint: "Modern, easy on the eyes" },
  { id: "system", label: "System", icon: "🖥️", hint: "Modern, follows your device" },
];

const KEY = "summary-hub:theme";
const VALID = new Set<Theme>(THEMES.map((t) => t.id));

function load(): Theme {
  try {
    const v = localStorage.getItem(KEY) as Theme | null;
    if (v && VALID.has(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
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
  const isPixel = computed(() => theme.value.startsWith("pixel"));
  const icon = computed(() => THEMES.find((t) => t.id === theme.value)?.icon ?? "👾");
  /** Header quick-toggle: cycles through the list in order. */
  function cycle() {
    const i = THEMES.findIndex((t) => t.id === theme.value);
    theme.value = THEMES[(i + 1) % THEMES.length].id;
  }
  return { theme, themes: THEMES, isPixel, icon, setTheme: (t: Theme) => (theme.value = t), cycle };
}
