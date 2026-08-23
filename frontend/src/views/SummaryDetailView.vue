<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type Summary } from "../api/client";

const props = defineProps<{ id: string }>();
const router = useRouter();

const summary = ref<Summary | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    summary.value = await api.get(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const htmlContent = computed(() => summary.value?.content ?? "");

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function edit() {
  router.push({ name: "edit", params: { id: props.id } });
}
function back() {
  router.push({ name: "list" });
}

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <!-- Breadcrumb -->
    <nav class="mb-8 flex items-center gap-2 text-xs tracking-wide text-ink-faint">
      <router-link
        to="/"
        class="rounded transition-colors duration-150 hover:text-accent"
      >
        My summaries
      </router-link>
      <span aria-hidden="true">/</span>
      <span class="truncate text-ink-muted">{{ summary?.sessionTitle ?? "…" }}</span>
    </nav>

    <!-- Error -->
    <div v-if="error" class="notice-danger mb-6">
      <svg class="mt-0.5 h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-4 py-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="h-2.5 w-28 rounded-full bg-paper-dim"></div>
      <div class="h-7 w-3/4 rounded-full bg-paper-dim"></div>
      <div class="h-px bg-line"></div>
      <div class="h-3 w-full rounded-full bg-paper-dim"></div>
      <div class="h-3 w-11/12 rounded-full bg-paper-dim"></div>
      <div class="h-3 w-2/3 rounded-full bg-paper-dim"></div>
    </div>

    <!-- Not found -->
    <div v-else-if="!summary" class="py-20 text-center">
      <p class="font-serif text-title text-ink">Summary not found</p>
      <p class="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        It may have been deleted, or the link is wrong.
      </p>
      <button type="button" class="btn btn-primary mt-6" @click="back">
        Back to summaries
      </button>
    </div>

    <!-- Detail -->
    <article v-else>
      <header class="border-b border-line pb-7">
        <p class="text-xs font-semibold uppercase tracking-[0.09em] text-accent">
          {{ summary.podcastName }}
        </p>
        <h1 class="mt-2.5 font-serif text-display text-ink">
          {{ summary.sessionTitle }}
        </h1>
        <div
          class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted"
        >
          <span v-if="summary.guest">with {{ summary.guest }}</span>
          <span v-if="summary.guest" class="text-line" aria-hidden="true">·</span>
          <span>{{ fmtDate(summary.createdAt) }}</span>
          <a
            v-if="summary.url"
            :href="summary.url"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 rounded text-accent underline decoration-accent/30 underline-offset-2 transition-colors duration-150 hover:decoration-accent"
          >
            Listen
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-primary" @click="edit">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.886L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
              />
            </svg>
            Edit notes
          </button>
          <button type="button" class="btn btn-ghost" @click="back">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            All summaries
          </button>
        </div>
      </header>

      <!-- Notes -->
      <div class="pt-8">
        <div
          v-if="htmlContent"
          class="rendered-html text-[1.0625rem]"
          v-html="htmlContent"
        ></div>
        <p v-else class="font-serif text-base italic text-ink-faint">
          No notes were written for this episode yet.
        </p>

        <!-- AI-generated summary -->
        <section
          v-if="summary.summaryGeneratorText"
          class="mt-12 rounded-2xl bg-accent-soft/60 px-5 py-5 sm:px-7 sm:py-6"
        >
          <h2
            class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-accent"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M10 1.5l1.6 4.3 4.4 1.6-4.4 1.6L10 13.3 8.4 9 4 7.4l4.4-1.6L10 1.5zM15.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
              />
            </svg>
            Generated summary
          </h2>
          <p class="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">
            {{ summary.summaryGeneratorText }}
          </p>
        </section>

        <p class="mt-12 border-t border-line-soft pt-5 text-xs text-ink-faint">
          Last updated {{ new Date(summary.updatedAt).toLocaleString() }}
        </p>
      </div>
    </article>
  </section>
</template>
