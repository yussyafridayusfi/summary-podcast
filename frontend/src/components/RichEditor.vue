<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  /** Rough height of the writing surface; the toolbar sits above it. */
  minHeight?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// Quill emits its own empty-document markup; treat that as "" so the required
// checks and character counts don't see a value that looks blank to the user.
const EMPTY = ["<p><br></p>", "<p></p>", "<p><br/></p>"];

/**
 * Strips Quill's internal scaffolding before the value leaves the editor.
 *
 * `ql-cursor` / `ql-ui` spans are transient editor chrome, and the cursor spans
 * carry zero-width U+FEFF characters. Persisting them pollutes the stored HTML
 * and leaks invisible characters into exports and AI prompts. Quill rebuilds
 * both on load, so removing them is lossless.
 */
function clean(html: string): string {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="r">${html}</div>`,
      "text/html",
    );
    const root = doc.getElementById("r");
    if (!root) return html;
    root.querySelectorAll("span.ql-cursor, span.ql-ui").forEach((n) => n.remove());
    return root.innerHTML.replace(/\uFEFF/g, "");
  } catch {
    return html;
  }
}

function normalise(html: string): string {
  const cleaned = clean(html);
  return EMPTY.includes(cleaned.trim()) ? "" : cleaned;
}

const internal = ref(props.modelValue || "");

// Keep the editor in sync when the parent swaps records (e.g. loading a row).
watch(
  () => props.modelValue,
  (val) => {
    if (normalise(val || "") !== normalise(internal.value)) {
      internal.value = val || "";
    }
  },
);

function onUpdate(html: string) {
  internal.value = html;
  emit("update:modelValue", normalise(html));
}

const toolbar = [
  ["bold", "italic", "underline", "strike"],
  [{ header: 1 }, { header: 2 }, { header: 3 }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link"],
  ["clean"],
];

const plainText = computed(() =>
  normalise(internal.value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
);

const charCount = computed(() => plainText.value.length);
</script>

<template>
  <div
    class="rich-editor overflow-hidden rounded-xl border border-line bg-surface transition-shadow duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]"
    :style="{ '--editor-min-height': minHeight ?? '20rem' }"
  >
    <QuillEditor
      theme="snow"
      content-type="html"
      :content="internal"
      :placeholder="placeholder ?? 'Start writing your notes…'"
      :toolbar="toolbar"
      @update:content="onUpdate"
    />
    <div
      class="flex justify-end px-4 py-2 text-[11px] tracking-wide text-ink-faint"
    >
      {{ charCount }} characters
    </div>
  </div>
</template>

<style scoped>
/* Quill ships its own chrome; this flattens it onto the app's paper surface —
   hairline rules, ink-ramp icons, accent for the active state. Behaviour and
   markup come from Quill itself and are untouched. */
.rich-editor :deep(.ql-toolbar.ql-snow) {
  border: none;
  border-bottom: 1px solid var(--color-line-soft);
  background: var(--color-paper);
  padding: 0.5rem 0.75rem;
}

.rich-editor :deep(.ql-toolbar.ql-snow .ql-formats) {
  margin-right: 0.75rem;
}

.rich-editor :deep(.ql-snow.ql-toolbar button) {
  border-radius: 0.375rem;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.rich-editor :deep(.ql-snow.ql-toolbar button:hover),
.rich-editor :deep(.ql-snow.ql-toolbar .ql-picker-label:hover) {
  background: var(--color-paper-dim);
}

.rich-editor :deep(.ql-snow.ql-toolbar button.ql-active) {
  background: var(--color-accent-soft);
}

.rich-editor :deep(.ql-container.ql-snow) {
  border: none;
  font-family: inherit;
  font-size: 1.0625rem;
  color: var(--color-ink-soft);
}

.rich-editor :deep(.ql-editor) {
  min-height: var(--editor-min-height, 20rem);
  padding: 1.25rem 1.25rem 1rem;
  line-height: 1.75;
}

.rich-editor :deep(.ql-editor h1),
.rich-editor :deep(.ql-editor h2),
.rich-editor :deep(.ql-editor h3) {
  font-family: var(--font-serif);
  letter-spacing: -0.01em;
  color: var(--color-ink);
}

.rich-editor :deep(.ql-editor blockquote) {
  border-left: 2px solid var(--color-accent);
  padding-left: 1rem;
  color: var(--color-ink-muted);
  font-family: var(--font-serif);
  font-style: italic;
}

.rich-editor :deep(.ql-editor.ql-blank::before) {
  left: 1.25rem;
  right: 1.25rem;
  font-style: normal;
  color: var(--color-ink-faint);
}

/* Icon colours: muted ink at rest, accent when hovered or active. */
.rich-editor :deep(.ql-snow .ql-stroke) {
  stroke: var(--color-ink-muted);
}
.rich-editor :deep(.ql-snow .ql-fill) {
  fill: var(--color-ink-muted);
}
.rich-editor :deep(.ql-snow .ql-picker-label) {
  color: var(--color-ink-muted);
}
.rich-editor :deep(.ql-snow button:hover .ql-stroke),
.rich-editor :deep(.ql-snow button.ql-active .ql-stroke),
.rich-editor :deep(.ql-snow .ql-picker-item:hover .ql-stroke),
.rich-editor :deep(.ql-snow .ql-picker-label.ql-active .ql-stroke) {
  stroke: var(--color-accent);
}
.rich-editor :deep(.ql-snow button:hover .ql-fill),
.rich-editor :deep(.ql-snow button.ql-active .ql-fill) {
  fill: var(--color-accent);
}
.rich-editor :deep(.ql-snow button.ql-active),
.rich-editor :deep(.ql-snow .ql-picker-label.ql-active) {
  color: var(--color-accent);
}

/* Quill's link tooltip. */
.rich-editor :deep(.ql-snow .ql-tooltip) {
  border: 1px solid var(--color-line);
  border-radius: 0.625rem;
  box-shadow: 0 4px 16px rgb(33 31 28 / 0.1);
  color: var(--color-ink-soft);
}
.rich-editor :deep(.ql-snow .ql-tooltip a.ql-action),
.rich-editor :deep(.ql-snow .ql-tooltip a.ql-remove) {
  color: var(--color-accent);
}
</style>
