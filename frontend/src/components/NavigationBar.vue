<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type SummaryType = 'podcast' | 'food-review';

interface NavItem {
  id: SummaryType;
  label: string;
  icon: string;
  description: string;
}

const router = useRouter();
const route = useRoute();

const navItems: NavItem[] = [
  {
    id: 'podcast',
    label: 'Podcast Notes',
    icon: '🎙️',
    description: 'Summarize and organize podcast notes',
  },
  {
    id: 'food-review',
    label: 'Food Reviews',
    icon: '🍽️',
    description: 'Document and review dining experiences',
  },
];

// Determine active tab based on route or default to podcast
const activeTab = computed((): SummaryType => {
  const query = route.query.type as string | undefined;
  if (query === 'food-review') return 'food-review';
  return 'podcast';
});

/**
 * Switch to a different summary type
 */
function switchTab(type: SummaryType) {
  // Navigate to the list page with the type parameter
  router.push({
    name: 'list',
    query: { type },
  });
}

/**
 * Navigate to the new summary creation page
 */
function createNew() {
  router.push({
    name: 'new',
    query: { type: activeTab.value },
  });
}
</script>

<template>
  <nav class="border-b border-line-soft bg-paper sticky top-0 z-40">
    <div class="mx-auto max-w-6xl px-5 sm:px-8">
      <!-- Tab Navigation -->
      <div class="flex items-center justify-between gap-4 py-4">
        <div class="flex items-center gap-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            @click="switchTab(item.id)"
            :class="[
              'inline-flex items-center gap-2.5 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 relative',
              activeTab === item.id
                ? 'text-accent'
                : 'text-ink-faint hover:text-ink-muted',
            ]"
            :title="item.description"
          >
            <!-- Underline indicator for active tab -->
            <span
              v-if="activeTab === item.id"
              class="absolute inset-x-0 -bottom-4 h-0.5 bg-accent"
            ></span>

            <!-- Icon -->
            <span class="text-base">{{ item.icon }}</span>

            <!-- Label -->
            <span class="hidden sm:inline">{{ item.label }}</span>
          </button>
        </div>

        <!-- Create New Button -->
        <button
          @click="createNew"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors duration-200"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 5v10M5 10h10" />
          </svg>
          <span class="hidden sm:inline">New</span>
        </button>
      </div>

      <!-- Breadcrumb/Type Info -->
      <div
        v-if="$slots.default"
        class="flex items-center gap-2 py-2 text-xs text-ink-faint border-t border-line-soft"
      >
        <slot></slot>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* Smooth color transitions */
button {
  transition-property: background-color, border-color, color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
