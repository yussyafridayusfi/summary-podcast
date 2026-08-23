<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type Summary } from "../api/client";
import DateTable, { type Column } from "../components/DateTable.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";

const router = useRouter();
const items = ref<Summary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const pendingDelete = ref<Summary | null>(null);

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const { items: list } = await api.list();
    items.value = list;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openDetail(row: Summary) {
  router.push({ name: "detail", params: { id: row.id } });
}

function edit(row: Summary) {
  router.push({ name: "edit", params: { id: row.id } });
}

function generate(row: Summary) {
  router.push({ name: "generate", params: { id: row.id } });
}

function remove(row: Summary) {
  pendingDelete.value = row;
}

async function confirmRemove() {
  const row = pendingDelete.value;
  if (!row) return;
  pendingDelete.value = null;
  error.value = null;
  try {
    await api.remove(row.id);
    items.value = items.value.filter((s) => s.id !== row.id);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stripHtml(s: string): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(s: string, n: number): string {
  const text = stripHtml(s);
  return text.length > n ? text.slice(0, n) + "…" : text;
}

const total = computed(() => items.value.length);

const columns: Column<Summary>[] = [
  {
    key: "podcastName",
    label: "Podcast",
    sortable: true,
    filterable: true,
    cellClass:
      "max-w-[150px] truncate text-xs font-semibold uppercase tracking-[0.07em] text-accent",
  },
  {
    key: "sessionTitle",
    label: "Session",
    sortable: true,
    filterable: true,
    cellClass: "max-w-[250px] truncate font-serif text-[0.975rem] text-ink",
  },
  {
    key: "guest",
    label: "Guest",
    sortable: true,
    filterable: true,
    display: (r) => r.guest || "—",
    filterValue: (r) => r.guest ?? "",
    cellClass: "max-w-[130px] truncate text-ink-muted",
    hideBelow: "lg",
  },
  {
    key: "url",
    label: "Link",
    sortable: false,
    filterable: true,
    display: (r) => (r.url ? r.url.replace(/^https?:\/\/(www\.)?/, "") : "—"),
    filterValue: (r) => r.url ?? "",
    cellClass: "max-w-[130px] truncate text-ink-faint",
    hideBelow: "xl",
  },
  {
    key: "content",
    label: "Notes",
    sortable: false,
    filterable: true,
    display: (r) => truncate(r.content, 220),
    filterValue: (r) => stripHtml(r.content),
    cellClass: "max-w-[320px] line-clamp-2 leading-relaxed text-ink-muted",
    hideBelow: "md",
  },
  {
    key: "createdAt",
    label: "Created",
    sortable: true,
    filterable: true,
    display: (r) => fmtDate(r.createdAt),
    filterValue: (r) => r.createdAt,
    cellClass: "whitespace-nowrap text-xs text-ink-faint",
    hideBelow: "xl",
  },
  {
    key: "updatedAt",
    label: "Updated",
    sortable: true,
    filterable: true,
    display: (r) => fmtDate(r.updatedAt),
    filterValue: (r) => r.updatedAt,
    cellClass: "whitespace-nowrap text-xs text-ink-faint",
    hideBelow: "md",
  },
];

onMounted(refresh);
</script>

<template>
  <section>
    <!-- Page header -->
    <header
      class="mb-9 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end"
    >
      <div>
        <h1 class="font-serif text-display text-ink">My summaries</h1>
        <p class="mt-2 text-sm text-ink-muted">
          <template v-if="loading">Opening your notebook…</template>
          <template v-else-if="total">
            {{ total }} {{ total === 1 ? "episode" : "episodes" }} written up so far.
          </template>
          <template v-else>A quiet place to keep what you heard.</template>
        </p>
      </div>
      <router-link to="/new" class="btn btn-primary w-full sm:w-auto">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clip-rule="evenodd"
          />
        </svg>
        New summary
      </router-link>
    </header>

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

    <!-- Table -->
    <DateTable
      :rows="items"
      :columns="columns"
      :loading="loading"
      :row-key="(r: Summary) => r.id"
      empty-text="Your notebook is empty"
      empty-hint="Start with ‘New summary’ and write up the last thing you listened to."
      @row-click="openDetail"
    >
      <template #actions="{ row }">
        <!-- Labelled on the stacked mobile cards, icon-only in the table. -->
        <button
          type="button"
          class="icon-btn w-auto gap-1.5 px-2.5 text-xs sm:w-8 sm:px-0"
          title="Generate summary"
          aria-label="Generate summary"
          @click="generate(row)"
        >
          <svg class="h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 1.5l1.6 4.3 4.4 1.6-4.4 1.6L10 13.3 8.4 9 4 7.4l4.4-1.6L10 1.5zM15.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
            />
          </svg>
          <span class="sm:hidden">Generate</span>
        </button>
        <button
          type="button"
          class="icon-btn w-auto gap-1.5 px-2.5 text-xs sm:w-8 sm:px-0"
          title="Edit"
          aria-label="Edit"
          @click="edit(row)"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.886L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
            />
          </svg>
          <span class="sm:hidden" aria-hidden="true">Edit</span>
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-danger ml-auto w-auto gap-1.5 px-2.5 text-xs sm:ml-0 sm:w-8 sm:px-0"
          title="Delete"
          aria-label="Delete"
          @click="remove(row)"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="sm:hidden" aria-hidden="true">Delete</span>
        </button>
      </template>
    </DateTable>

    <ConfirmDialog
      :open="!!pendingDelete"
      title="Delete this summary?"
      :message="pendingDelete ? `“${pendingDelete.sessionTitle}” will be permanently deleted. This can't be undone.` : ''"
      confirm-text="Delete"
      danger
      @confirm="confirmRemove"
      @cancel="pendingDelete = null"
    />
  </section>
</template>
