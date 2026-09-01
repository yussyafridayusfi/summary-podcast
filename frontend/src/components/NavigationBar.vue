<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

interface Tab {
  key: "podcast" | "food";
  label: string;
  icon: string;
  /** Route the tab lands on. */
  to: string;
}

const TABS: Tab[] = [
  { key: "podcast", label: "Podcasts", icon: "🎙️", to: "/" },
  { key: "food", label: "Food reviews", icon: "🍽️", to: "/food" },
];

const route = useRoute();

// Driven by the URL rather than local state, so a deep link or a refresh lands
// on the right tab.
const active = computed<Tab>(
  () => TABS.find((t) => t.key === "food" && route.path.startsWith("/food")) ?? TABS[0],
);
</script>

<template>
  <nav class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-end gap-1 px-6">
      <router-link
        v-for="tab in TABS"
        :key="tab.key"
        :to="tab.to"
        class="-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium no-underline transition"
        :class="
          active.key === tab.key
            ? 'border-indigo-600 text-indigo-700'
            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
        "
        :aria-current="active.key === tab.key ? 'page' : undefined"
      >
        <span aria-hidden="true">{{ tab.icon }}</span>
        {{ tab.label }}
      </router-link>
    </div>
  </nav>
</template>
