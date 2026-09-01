<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import { NOTE_IMAGE_MAX_EDGE, downscaleImage, pickImageFile } from "../lib/image";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  minHeight?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const internal = ref(props.modelValue || "");
const EMPTY = ["<p><br></p>", "<p></p>", "<p><br/></p>"];

const imageError = ref<string | null>(null);
const imageBusy = ref(false);

function normalise(html: string) {
  return EMPTY.includes(html.trim()) ? "" : html;
}

// Keep editor in sync if parent resets the value (e.g. switching records).
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

/**
 * Quill's stock image handler inserts the file at full resolution, which puts a
 * multi-megabyte data URI straight into the notes. This one downscales first.
 */
async function insertImage(this: unknown) {
  // `this` is the Quill toolbar module; its .quill is the editor instance.
  const quill = (this as { quill?: QuillLike })?.quill;
  if (!quill) return;

  const file = await pickImageFile();
  if (!file) return;

  imageError.value = null;
  imageBusy.value = true;
  try {
    const dataUri = await downscaleImage(file, NOTE_IMAGE_MAX_EDGE);
    const range = quill.getSelection(true);
    const at = range ? range.index : quill.getLength();
    quill.insertEmbed(at, "image", dataUri, "user");
    quill.setSelection(at + 1, 0);
  } catch (e) {
    imageError.value = (e as Error).message;
  } finally {
    imageBusy.value = false;
  }
}

/** The slice of Quill's API this component uses. */
interface QuillLike {
  getSelection(focus?: boolean): { index: number; length: number } | null;
  getLength(): number;
  insertEmbed(index: number, type: string, value: unknown, source?: string): void;
  setSelection(index: number, length: number): void;
}

const toolbar = {
  container: [
    ["bold", "italic", "underline", "strike"],
    [{ header: 1 }, { header: 2 }, { header: 3 }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ],
  handlers: { image: insertImage },
};

const charCount = computed(() =>
  normalise(internal.value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim().length,
);

const imageCount = computed(
  () => (normalise(internal.value).match(/<img\b/gi) ?? []).length,
);
</script>

<template>
  <div
    class="rich-editor overflow-hidden rounded-xl border border-slate-300 bg-white"
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
      class="flex items-center justify-between gap-3 px-4 py-2 text-[11px] tracking-wide text-slate-400"
    >
      <span v-if="imageBusy" class="text-slate-500">Adding image…</span>
      <span v-else-if="imageError" class="text-rose-600">{{ imageError }}</span>
      <span v-else></span>
      <span>
        {{ charCount }} characters
        <template v-if="imageCount">
          · {{ imageCount }} image{{ imageCount === 1 ? "" : "s" }}
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.rich-editor :deep(.ql-toolbar.ql-snow) {
  border: none;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.rich-editor :deep(.ql-container.ql-snow) {
  border: none;
  font-family: inherit;
  color: #334155;
}
.rich-editor :deep(.ql-editor) {
  min-height: var(--editor-min-height, 20rem);
  padding: 1.25rem;
  line-height: 1.75;
}
/* Keep pasted or uploaded images inside the editor column. */
.rich-editor :deep(.ql-editor img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}
</style>
