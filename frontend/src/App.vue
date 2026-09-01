<script setup lang="ts">
import { ref } from "vue";
import { getOrCreateUserId } from "./api/user";
import NavigationBar from "./components/NavigationBar.vue";

const userId = ref(getOrCreateUserId());
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="mx-auto flex max-w-6xl items-baseline justify-between px-6 pt-8 pb-4">
      <router-link
        to="/"
        class="text-2xl font-bold text-slate-800 no-underline hover:text-indigo-600"
      >
        📝 Summary Hub
      </router-link>
      <span class="text-xs text-slate-500" :title="userId">
        user: {{ userId.slice(0, 8) }}…
      </span>
    </header>
    <NavigationBar />
    <main class="mx-auto max-w-6xl px-6 pt-6 pb-16">
      <router-view />
    </main>
  </div>
</template>
