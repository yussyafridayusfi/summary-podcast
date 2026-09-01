<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { foodApi, type FoodReview } from "../api/client";

const props = defineProps<{ id: string }>();
const router = useRouter();

const review = ref<FoodReview | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    review.value = await foodApi.get(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const htmlContent = computed(() => review.value?.content ?? "");

/** Plain YYYY-MM-DD — build the Date from parts so it isn't shifted by the
 *  local UTC offset. */
const visitLabel = computed(() => {
  const s = review.value?.dateVisit;
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

function edit() {
  router.push({ name: "food-edit", params: { id: props.id } });
}
function generate() {
  router.push({ name: "food-generate", params: { id: props.id } });
}
function back() {
  router.push({ name: "food-list" });
}

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <!-- Breadcrumb -->
    <nav class="mb-4 flex items-center gap-2 text-sm text-slate-500">
      <router-link to="/food" class="hover:text-indigo-600">Food reviews</router-link>
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="truncate font-medium text-slate-700">
        {{ review?.restoName ?? "…" }}
      </span>
    </nav>

    <!-- Error -->
    <div
      v-if="error"
      class="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      <svg class="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24"
    >
      <div class="flex items-center gap-3 text-slate-500">
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        Loading…
      </div>
    </div>

    <!-- Not found -->
    <div
      v-else-if="!review"
      class="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center"
    >
      <p class="text-sm font-medium text-slate-700">Food review not found</p>
      <p class="mt-1 text-sm text-slate-500">
        It may have been deleted, or the link is wrong.
      </p>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        @click="back"
      >
        ← Back to food reviews
      </button>
    </div>

    <!-- Detail card -->
    <article
      v-else
      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header
        class="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white p-6 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">
            {{ review.restoName }}
          </h1>
          <p v-if="review.description" class="mt-1 text-sm font-medium text-slate-700">
            {{ review.description }}
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span v-if="visitLabel">🗓️ {{ visitLabel }}</span>
            <span v-if="visitLabel && review.location" class="text-slate-300">·</span>
            <span v-if="review.location">📍 {{ review.location }}</span>
            <span v-if="review.urlWebResto" class="text-slate-300">·</span>
            <a
              v-if="review.urlWebResto"
              :href="review.urlWebResto"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              Website
            </a>
          </p>
          <p class="mt-1 text-xs text-slate-500">
            Created {{ new Date(review.createdAt).toLocaleString() }} ·
            updated {{ new Date(review.updatedAt).toLocaleString() }}
          </p>
        </div>
        <div class="flex flex-shrink-0 flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            @click="back"
          >
            ← Back
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            @click="edit"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.886L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
              />
            </svg>
            Edit
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            @click="generate"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M10 1.5l1.6 4.3 4.4 1.6-4.4 1.6L10 13.3 8.4 9 4 7.4l4.4-1.6L10 1.5zM15.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
              />
            </svg>
            Generate &amp; export
          </button>
        </div>
      </header>

      <!-- Photo -->
      <div v-if="review.imageDataUri" class="border-b border-slate-100 bg-slate-50 p-6">
        <img
          :src="review.imageDataUri"
          :alt="`Photo from ${review.restoName}`"
          class="mx-auto max-h-96 rounded-lg object-contain"
        />
      </div>

      <!-- Notes -->
      <div class="p-6">
        <div
          v-if="htmlContent"
          class="rendered-html prose prose-slate max-w-none text-base"
          v-html="htmlContent"
        ></div>
        <p v-else class="text-sm italic text-slate-500">
          No notes were written for this review yet.
        </p>
      </div>

      <!-- Generated summary -->
      <div
        v-if="review.summaryGeneratorText"
        class="border-t border-slate-100 bg-slate-50/60 p-6"
      >
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Generated summary
        </h2>
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {{ review.summaryGeneratorText }}
        </p>
      </div>
    </article>
  </section>
</template>
