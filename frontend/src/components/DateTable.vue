<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref } from "vue";

export interface Column<R> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Included when searching the table's global search box. */
  filterable?: boolean;
  display?: (row: R) => string;
  filterValue?: (row: R) => string;
  cellClass?: string;
  html?: boolean;
  width?: string;
  /** Hide this column below the given breakpoint to keep the table usable on small screens. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
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
const search = ref("");

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

function sortState(col: Column<T>): SortDir {
  return sortKey.value === col.key ? sortDir.value : null;
}

/** Maps the tri-state sort into the ARIA value assistive tech expects. */
function ariaSort(col: Column<T>): "ascending" | "descending" | "none" | undefined {
  if (!col.sortable) return undefined;
  const state = sortState(col);
  return state === "asc" ? "ascending" : state === "desc" ? "descending" : "none";
}

const searchableColumns = computed(() => props.columns.filter((c) => c.filterable));

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  const cols = searchableColumns.value;
  return props.rows.filter((row) =>
    cols.some((col) => getFilterValue(row, col).toLowerCase().includes(q)),
  );
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

const hideClasses: Record<NonNullable<Column<T>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function colClasses(col: Column<T>): string {
  return col.hideBelow ? hideClasses[col.hideBelow] : "";
}

/* ── Stacked layout for narrow screens ───────────────────────────────────────
   Below `sm` a table can only be read by scrolling sideways, so the same rows
   are rendered as cards. The mapping is positional so the component stays
   generic: the first column becomes the card's eyebrow, the second its title,
   and the remaining columns become label/value meta lines — minus the ones the
   caller already marked as wide-screen-only (`hideBelow` lg/xl), which keeps
   the card short. Sorting and searching feed both layouts from the same
   computed rows, so they behave identically. */
const cardEyebrow = computed(() => props.columns[0]);
const cardTitle = computed(() => props.columns[1] ?? props.columns[0]);
const cardMeta = computed(() =>
  props.columns
    .slice(2)
    .filter((c) => !c.hideBelow || c.hideBelow === "sm" || c.hideBelow === "md"),
);

function activate(row: T) {
  emit("row-click", row);
}
</script>

<template>
  <div class="w-full">
    <!-- Search -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="relative w-full sm:max-w-xs">
        <label for="table-search" class="sr-only">Search summaries</label>
        <span
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
        <input
          id="table-search"
          v-model="search"
          type="text"
          placeholder="Search your notes…"
          class="field pl-9 pr-9 text-sm"
        />
        <button
          v-if="search"
          type="button"
          class="absolute inset-y-0 right-0 flex items-center rounded-r-[0.625rem] pr-3 text-ink-faint transition-colors duration-150 hover:text-ink"
          aria-label="Clear search"
          @click="search = ''"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>
      <p
        v-if="search"
        class="text-xs tracking-wide text-ink-muted"
        role="status"
        aria-live="polite"
      >
        <span class="font-semibold text-ink">{{ filteredRows.length }}</span>
        of {{ rows.length }} match
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3 py-2" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading summaries…</span>
      <div
        v-for="n in 4"
        :key="n"
        class="flex animate-pulse items-center gap-4 border-b border-line-soft pb-5 pt-1"
      >
        <div class="flex-1 space-y-2.5">
          <div class="h-2.5 w-24 rounded-full bg-paper-dim"></div>
          <div class="h-3.5 rounded-full bg-paper-dim" :class="n % 2 ? 'w-2/3' : 'w-1/2'"></div>
        </div>
        <div class="h-2.5 w-16 rounded-full bg-paper-dim"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!sortedRows.length" class="px-6 py-20 text-center">
      <span
        class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-paper-dim text-ink-faint"
        aria-hidden="true"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" d="M5.5 3.75h9a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path stroke-linecap="round" d="M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" />
        </svg>
      </span>
      <p class="font-serif text-lg text-ink">
        {{ search ? "Nothing matches that search" : (emptyText ?? "No rows.") }}
      </p>
      <p v-if="search" class="mt-1.5 text-sm text-ink-muted">
        Try a shorter phrase, or clear the search box.
      </p>
      <p v-else-if="emptyHint" class="mt-1.5 text-sm text-ink-muted">{{ emptyHint }}</p>
    </div>

    <template v-else>
      <!-- Stacked cards (below sm) -->
      <ul class="-mt-1 space-y-2 sm:hidden">
        <li
          v-for="row in sortedRows"
          :key="rowKey(row)"
          class="rounded-2xl border border-line-soft bg-surface px-4 py-4 transition-shadow duration-200 focus-within:shadow-[0_2px_10px_rgb(33_31_28/0.07)]"
          :class="props.rowClass?.(row)"
        >
          <button
            type="button"
            class="block w-full cursor-pointer text-left"
            :aria-label="cardTitle ? getCellValue(row, cardTitle) : undefined"
            @click="activate(row)"
          >
            <span
              v-if="cardEyebrow"
              class="block text-[11px] font-semibold uppercase tracking-[0.09em] text-accent"
            >
              {{ getCellValue(row, cardEyebrow) }}
            </span>
            <span
              v-if="cardTitle"
              class="mt-1 block font-serif text-base leading-snug text-ink"
            >
              {{ getCellValue(row, cardTitle) }}
            </span>
            <span
              v-for="col in cardMeta"
              :key="col.key"
              class="mt-2 block text-sm leading-relaxed text-ink-muted"
            >
              <template v-if="col.html">
                <span class="line-clamp-2" v-html="getCellValue(row, col)"></span>
              </template>
              <template v-else>
                <span class="line-clamp-2">{{ getCellValue(row, col) }}</span>
              </template>
            </span>
          </button>
          <div
            v-if="$slots.actions"
            class="mt-3 flex items-center gap-1 border-t border-line-soft pt-2.5"
          >
            <slot name="actions" :row="row" />
          </div>
        </li>
      </ul>

      <!-- Table (sm and up) -->
      <div class="hidden sm:block">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  v-for="col in columns"
                  :key="col.key"
                  scope="col"
                  class="border-b border-line px-3 py-2.5 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint transition-colors duration-150 first:pl-1"
                  :class="[
                    col.sortable ? 'cursor-pointer select-none hover:text-ink-muted' : '',
                    colClasses(col),
                  ]"
                  :style="col.width ? { width: col.width } : undefined"
                  :aria-sort="ariaSort(col)"
                  @click="clickHeader(col)"
                >
                  <button
                    v-if="col.sortable"
                    type="button"
                    class="inline-flex cursor-pointer items-center gap-1 rounded uppercase tracking-[0.09em]"
                    @click.stop="clickHeader(col)"
                  >
                    <span>{{ col.label }}</span>
                    <span
                      class="transition-colors duration-150"
                      :class="sortState(col) ? 'text-accent' : 'text-line'"
                      aria-hidden="true"
                    >
                      <svg
                        v-if="sortState(col) === 'asc'"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <svg
                        v-else-if="sortState(col) === 'desc'"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <svg v-else class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 11-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.24a.75.75 0 011.06.02L10 15.148l2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.02-1.06z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                  </button>
                  <span v-else>{{ col.label }}</span>
                </th>
                <th
                  v-if="$slots.actions"
                  scope="col"
                  class="sticky right-0 w-px bg-paper px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint shadow-[inset_0_-1px_0_var(--color-line)]"
                >
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in sortedRows"
                :key="rowKey(row)"
                tabindex="0"
                class="cursor-pointer bg-paper align-top transition-colors duration-150 hover:bg-surface focus-visible:bg-surface"
                :class="props.rowClass?.(row)"
                @click="activate(row)"
                @keydown.enter="activate(row)"
                @keydown.space.prevent="activate(row)"
              >
                <!-- `cellClass` lands on an inner block element: `truncate` and
                     `line-clamp-*` set their own `display`, which the cell's
                     own `table-cell` would otherwise cancel out. -->
                <td
                  v-for="col in columns"
                  :key="col.key"
                  class="border-b border-line-soft px-3 py-4 text-ink-soft first:pl-1"
                  :class="colClasses(col)"
                >
                  <div :class="col.cellClass">
                    <span v-if="!col.html">{{ getCellValue(row, col) }}</span>
                    <span v-else v-html="getCellValue(row, col)"></span>
                  </div>
                </td>
                <td
                  v-if="$slots.actions"
                  class="sticky right-0 w-px whitespace-nowrap bg-inherit px-2 py-3 text-right shadow-[inset_0_-1px_0_var(--color-line-soft)]"
                  @click.stop
                >
                  <div
                    class="row-actions flex items-center justify-end gap-0.5 transition-opacity duration-200 lg:opacity-50"
                  >
                    <slot name="actions" :row="row" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Reveal the per-row actions on hover/focus at desktop widths, where they'd
   otherwise compete with the content for attention. Touch layouts keep them
   fully visible. */
tbody tr:hover .row-actions,
tbody tr:focus-within .row-actions,
tbody tr:focus-visible .row-actions {
  opacity: 1;
}
</style>
