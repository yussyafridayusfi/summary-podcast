<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref } from "vue";

export interface Column<R> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  display?: (row: R) => string;
  filterValue?: (row: R) => string;
  cellClass?: string;
  html?: boolean;
  width?: string;
}

const props = defineProps<{
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  rowKey: (row: T) => string;
  emptyText?: string;
  emptyHint?: string;
  rowClass?: (row: T) => string | undefined;
}>();

const emit = defineEmits<{
  (e: "row-click", row: T): void;
}>();

type SortDir = "asc" | "desc" | null;
const sortKey = ref<string | null>(null);
const sortDir = ref<SortDir>(null);
const filters = ref<Record<string, string>>({});

function setFilter(key: string, value: string) {
  filters.value = { ...filters.value, [key]: value };
  if (!value) delete filters.value[key];
}

function clearAllFilters() {
  filters.value = {};
}

function getCellValue(row: T, col: Column<T>): string {
  if (col.display) return col.display(row);
  const v = (row as Record<string, unknown>)[col.key];
  return v == null ? "" : String(v);
}

function getFilterValue(row: T, col: Column<T>): string {
  if (col.filterValue) return col.filterValue(row);
  const v = (row as Record<string, unknown>)[col.key];
  return v == null ? "" : String(v);
}

function clickHeader(col: Column<T>) {
  if (!col.sortable) return;
  if (sortKey.value !== col.key) {
    sortKey.value = col.key;
    sortDir.value = "asc";
  } else if (sortDir.value === "asc") {
    sortDir.value = "desc";
  } else {
    sortKey.value = null;
    sortDir.value = null;
  }
}

const activeFilterCount = computed(
  () => Object.values(filters.value).filter((v) => v.trim()).length,
);

const filteredRows = computed(() => {
  const activeFilters = Object.entries(filters.value).filter(([, v]) => v.trim());
  if (activeFilters.length === 0) return props.rows;
  return props.rows.filter((row) => {
    for (const [key, q] of activeFilters) {
      const col = props.columns.find((c) => c.key === key);
      if (!col) continue;
      const value = getFilterValue(row, col).toLowerCase();
      if (!value.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });
});

const sortedRows = computed(() => {
  if (!sortKey.value || !sortDir.value) return filteredRows.value;
  const col = props.columns.find((c) => c.key === sortKey.value);
  if (!col) return filteredRows.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  return [...filteredRows.value].sort((a, b) => {
    const av = getFilterValue(a, col);
    const bv = getFilterValue(b, col);
    return av.localeCompare(bv) * dir;
  });
});

function sortIndicator(col: Column<T>): string {
  if (sortKey.value !== col.key) return "↕";
  if (sortDir.value === "asc") return "▲";
  if (sortDir.value === "desc") return "▼";
  return "↕";
}
</script>

<template>
  <div class="w-full">
    <!-- Filter toolbar -->
    <div
      v-if="activeFilterCount > 0"
      class="mb-3 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-700"
    >
      <span>
        <strong>{{ filteredRows.length }}</strong> of
        <strong>{{ rows.length }}</strong> rows match your filters
      </span>
      <button
        type="button"
        class="rounded px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        @click="clearAllFilters"
      >
        Clear filters
      </button>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16"
    >
      <div class="flex items-center gap-3 text-slate-500">
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        Loading summaries…
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!sortedRows.length"
      class="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center"
    >
      <svg
        class="mx-auto h-12 w-12 text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <p class="mt-3 text-sm font-medium text-slate-700">
        {{ emptyText ?? "No rows." }}
      </p>
      <p v-if="emptyHint" class="mt-1 text-sm text-slate-500">{{ emptyHint }}</p>
    </div>

    <!-- Table -->
    <div
      v-else
      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead class="bg-slate-50/80 text-slate-700">
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                class="border-b border-slate-200 px-4 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-slate-600"
                :class="col.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''"
                :style="col.width ? { width: col.width } : undefined"
                @click="clickHeader(col)"
              >
                <div class="mb-1.5 flex items-center justify-between gap-1">
                  <span>{{ col.label }}</span>
                  <span v-if="col.sortable" class="text-xs text-slate-400">
                    {{ sortIndicator(col) }}
                  </span>
                </div>
                <input
                  v-if="col.filterable"
                  type="text"
                  class="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-normal normal-case text-slate-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  :value="filters[col.key] ?? ''"
                  :placeholder="`Filter ${col.label.toLowerCase()}…`"
                  @click.stop
                  @input="(e) => setFilter(col.key, (e.target as HTMLInputElement).value)"
                />
              </th>
              <th
                v-if="$slots.actions"
                class="w-px border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="(row, i) in sortedRows"
              :key="rowKey(row)"
              class="cursor-pointer transition hover:bg-indigo-50/40"
              :class="[
                i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white',
                props.rowClass?.(row),
              ]"
              @click="emit('row-click', row)"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 align-top text-slate-700"
                :class="col.cellClass"
              >
                <span v-if="!col.html">{{ getCellValue(row, col) }}</span>
                <span v-else v-html="getCellValue(row, col)"></span>
              </td>
              <td
                v-if="$slots.actions"
                class="w-px whitespace-nowrap px-4 py-3 text-right"
                @click.stop
              >
                <slot name="actions" :row="row" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
