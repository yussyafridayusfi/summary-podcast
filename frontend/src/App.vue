<script setup lang="ts">
import { ref } from "vue";
import { getOrCreateUserId } from "./api/user";
import NavigationBar from "./components/NavigationBar.vue";

const userId = ref(getOrCreateUserId());
</script>

<template>
  <div class="min-h-screen bg-paper text-ink flex flex-col">
    <!-- Main Header -->
    <header class="border-b border-line-soft bg-paper">
      <div
        class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5"
      >
        <router-link
          to="/"
          class="group inline-flex items-center gap-2.5 rounded-lg no-underline"
        >
          <span
            class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white"
            aria-hidden="true"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
              <path stroke-linecap="round" d="M10 2.75a2.25 2.25 0 0 0-2.25 2.25v4a2.25 2.25 0 0 0 4.5 0v-4A2.25 2.25 0 0 0 10 2.75Z" />
              <path stroke-linecap="round" d="M5 8.75v.5a5 5 0 0 0 10 0v-.5M10 14.25v3" />
            </svg>
          </span>
          <span class="font-serif text-lg tracking-tight text-ink sm:text-xl">
            Summary&nbsp;Hub
          </span>
        </router-link>

        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] tracking-tight text-ink-faint transition-colors duration-200 hover:text-ink-muted"
          :title="`Notebook ${userId}`"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-accent/50" aria-hidden="true"></span>
          {{ userId.slice(0, 8) }}
        </span>
      </div>
    </header>

    <!-- Navigation Bar with Tabs -->
    <NavigationBar />

    <!-- Main Content -->
    <main class="flex-1 mx-auto w-full max-w-6xl px-5 pt-8 pb-20 sm:px-8 sm:pt-12">
      <router-view />
    </main>
  </div>
</template>
