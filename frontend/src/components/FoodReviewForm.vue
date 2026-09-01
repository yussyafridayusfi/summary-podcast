<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import RichEditor from "./RichEditor.vue";
import { PHOTO_MAX_EDGE, downscaleImage } from "../lib/image";
import type { FoodReview, FoodReviewInput } from "../api/client";

const props = defineProps<{
  initial: FoodReview | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", value: FoodReviewInput): void;
  (e: "cancel"): void;
  (e: "delete", id: string): void;
}>();

const form = reactive({
  restoName: "",
  description: "",
  dateVisit: "",
  location: "",
  urlWebResto: "",
  content: "",
  imageDataUri: null as string | null,
});

const photoError = ref<string | null>(null);
const photoBusy = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.initial,
  (r) => {
    form.restoName = r?.restoName ?? "";
    form.description = r?.description ?? "";
    form.dateVisit = r?.dateVisit ?? "";
    form.location = r?.location ?? "";
    form.urlWebResto = r?.urlWebResto ?? "";
    form.content = r?.content ?? "";
    form.imageDataUri = r?.imageDataUri ?? null;
  },
  { immediate: true },
);

async function onPhotoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  photoError.value = null;
  if (!file.type.startsWith("image/")) {
    photoError.value = "Please choose an image file.";
    return;
  }
  photoBusy.value = true;
  try {
    form.imageDataUri = await downscaleImage(file, PHOTO_MAX_EDGE);
  } catch (err) {
    photoError.value = (err as Error).message;
  } finally {
    photoBusy.value = false;
  }
}

function clearPhoto() {
  form.imageDataUri = null;
  photoError.value = null;
  if (fileInput.value) fileInput.value.value = "";
}

function onSubmit() {
  if (!form.restoName.trim()) return;
  emit("submit", {
    restoName: form.restoName.trim(),
    description: form.description.trim() || null,
    dateVisit: form.dateVisit || null,
    location: form.location.trim() || null,
    urlWebResto: form.urlWebResto.trim() || null,
    content: form.content,
    imageDataUri: form.imageDataUri,
  });
}
</script>

<template>
  <form
    class="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    @submit.prevent="onSubmit"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">
          {{ initial ? "Edit food review" : "New food review" }}
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          {{
            initial
              ? "Update the details below and save your changes."
              : "Capture where you ate, what you had, and what you thought."
          }}
        </p>
      </div>
      <span
        v-if="initial"
        class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
      >
        Editing
      </span>
    </div>

    <!-- Restaurant + dish -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label for="resto" class="mb-1.5 block text-sm font-medium text-slate-700">
          Restaurant name
          <span class="text-rose-500">*</span>
        </label>
        <input
          id="resto"
          v-model="form.restoName"
          required
          placeholder="e.g. Kopi Nako"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      <div>
        <label for="desc" class="mb-1.5 block text-sm font-medium text-slate-700">
          Description
          <span class="text-xs font-normal text-slate-400">(what you ate)</span>
        </label>
        <input
          id="desc"
          v-model="form.description"
          placeholder="e.g. Nasi goreng kambing"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>

    <!-- Visit + location -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label for="datevisit" class="mb-1.5 block text-sm font-medium text-slate-700">
          Date visited
          <span class="text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="datevisit"
          v-model="form.dateVisit"
          type="date"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      <div>
        <label for="location" class="mb-1.5 block text-sm font-medium text-slate-700">
          Location
          <span class="text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="location"
          v-model="form.location"
          placeholder="e.g. Bandung, Jawa Barat"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>

    <!-- Website -->
    <div>
      <label for="urlresto" class="mb-1.5 block text-sm font-medium text-slate-700">
        Restaurant website
        <span class="text-xs font-normal text-slate-400">(optional)</span>
      </label>
      <div class="relative">
        <span
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
        <input
          id="urlresto"
          v-model="form.urlWebResto"
          type="url"
          placeholder="https://example.com/restaurant"
          class="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>

    <!-- Photo -->
    <div>
      <label for="photo" class="mb-1.5 block text-sm font-medium text-slate-700">
        Food photo
        <span class="text-xs font-normal text-slate-400">
          (optional — used as the centrepiece of the generated image)
        </span>
      </label>
      <div class="flex flex-wrap items-start gap-4">
        <div
          v-if="form.imageDataUri"
          class="relative h-32 w-32 flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        >
          <img
            :src="form.imageDataUri"
            alt="Food photo preview"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <input
            id="photo"
            ref="fileInput"
            type="file"
            accept="image/*"
            :disabled="photoBusy"
            class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            @change="onPhotoChange"
          />
          <p v-if="photoBusy" class="text-xs text-slate-500">Processing photo…</p>
          <p v-else-if="photoError" class="text-xs text-rose-600">{{ photoError }}</p>
          <p v-else class="text-xs text-slate-400">
            Resized to {{ PHOTO_MAX_EDGE }}px on the long edge before saving.
          </p>
          <button
            v-if="form.imageDataUri"
            type="button"
            class="text-xs font-medium text-rose-600 hover:text-rose-800"
            @click="clearPhoto"
          >
            Remove photo
          </button>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div>
      <label class="mb-1.5 block text-sm font-medium text-slate-700">
        Notes
        <span class="text-xs font-normal text-slate-400">
          (rich text — bold, lists, headings, quotes, code)
        </span>
      </label>
      <RichEditor
        v-model="form.content"
        placeholder="How was it? Taste, price, service, would you go back…"
      />
    </div>

    <!-- Actions -->
    <div
      class="flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <button
        v-if="initial"
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
        @click="emit('delete', initial.id)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        Delete
      </button>
      <span v-else></span>
      <div class="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="submitting || photoBusy"
          class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span v-if="submitting" class="inline-block animate-spin">⏳</span>
          {{ submitting ? "Saving…" : initial ? "Save changes" : "Create review" }}
        </button>
      </div>
    </div>
  </form>
</template>
