<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { foodApi, type FoodReview } from "../api/client";
import DateTable, { type Column } from "../components/DateTable.vue";

const router = useRouter();
const items = ref<FoodReview[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const { items: list } = await foodApi.list();
    items.value = list;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openDetail(row: FoodReview) {
  router.push({ name: "food-detail", params: { id: row.id } });
}

function edit(row: FoodReview) {
  router.push({ name: "food-edit", params: { id: row.id } });
}

async function remove(row: FoodReview) {
  if (!confirm(`Delete the review for "${row.restoName}"?`)) return;
  error.value = null;
  try {
    await foodApi.remove(row.id);
    items.value = items.value.filter((r) => r.id !== row.id);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

/** `dateVisit` is a bare YYYY-MM-DD; parsing it as a Date would shift it by the
 *  local UTC offset, so format the parts directly. */
function fmtVisit(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
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

const columns: Column<FoodReview>[] = [
  {
    key: "restoName",
    label: "Restaurant",
    sortable: true,
    filterable: true,
    cellClass: "font-medium text-slate-800",
    width: "15%",
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    filterable: true,
    display: (r) => r.description || "—",
    width: "15%",
  },
  {
    key: "dateVisit",
    label: "Date visited",
    sortable: true,
    filterable: true,
    display: (r) => fmtVisit(r.dateVisit),
    // Sort and filter on the raw ISO day so ordering is chronological,
    // not alphabetical on the formatted label.
    filterValue: (r) => r.dateVisit ?? "",
    cellClass: "whitespace-nowrap text-slate-600",
    width: "11%",
  },
  {
    key: "location",
    label: "Location",
    sortable: true,
    filterable: true,
    display: (r) => r.location || "—",
    cellClass: "text-slate-600",
    width: "13%",
  },
  {
    key: "urlWebResto",
    label: "Website",
    sortable: false,
    filterable: true,
    display: (r) => r.urlWebResto || "—",
    cellClass: "max-w-0 truncate text-slate-500",
    width: "13%",
  },
  {
    key: "content",
    label: "Notes",
    sortable: false,
    filterable: true,
    display: (r) => truncate(r.content, 70) || "—",
    filterValue: (r) => stripHtml(r.content),
    cellClass: "text-slate-600",
    width: "20%",
  },
  {
    key: "updatedAt",
    label: "Updated",
    sortable: true,
    filterable: true,
    display: (r) => fmtDate(r.updatedAt),
    filterValue: (r) => r.updatedAt,
    cellClass: "whitespace-nowrap text-xs text-slate-500",
    width: "13%",
  },
];

onMounted(refresh);
</script>

<template>
  <section>
    <!-- Page header -->
    <div
      class="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
    >
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">
          Food reviews
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          <span class="font-medium text-slate-700">{{ total }}</span>
          {{ total === 1 ? "review" : "reviews" }} stored for this user.
        </p>
      </div>
      <router-link
        to="/food/new"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clip-rule="evenodd"
          />
        </svg>
        New review
      </router-link>
    </div>

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

    <!-- Table -->
    <DateTable
      :rows="items"
      :columns="columns"
      :loading="loading"
      :row-key="(r: FoodReview) => r.id"
      empty-text="No food reviews yet"
      empty-hint="Click ‘New review’ above to record your first one."
      @row-click="openDetail"
    >
      <template #actions="{ row }">
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-indigo-100 hover:text-indigo-700"
          title="Edit"
          aria-label="Edit"
          @click="edit(row)"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.886L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-100 hover:text-rose-700"
          title="Delete"
          aria-label="Delete"
          @click="remove(row)"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </template>
    </DateTable>
  </section>
</template>
