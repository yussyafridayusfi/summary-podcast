<script setup lang="ts">
import BottomSheet from "./BottomSheet.vue";

defineProps<{ open: boolean; firstRun?: boolean }>();
const emit = defineEmits<{ (e: "close"): void; (e: "start", kind: "podcast" | "food"): void }>();

const STEPS = [
  {
    icon: "🗂",
    title: "Pick a section",
    text: "Podcast for episode notes, Food for dishes, recipes and restaurant visits. Switch with the tabs at the bottom (or the header on desktop).",
  },
  {
    icon: "📝",
    title: "Jot rough notes",
    text: "Tap New, name the source and title, then paste anything: timestamps, quotes, ingredients, half-sentences. Messy is fine.",
  },
  {
    icon: "✨",
    title: "Generate with AI",
    text: "Pick a tone and language, hit Generate. You get a headline, key points, quotes, tags, a mood and a cover-illustration prompt. Edit any of it before saving.",
  },
  {
    icon: "🖼",
    title: "Export a share card",
    text: "Open a summary and tap Export card. Choose Square, Story or Wide, pick an illustration style, shuffle until you like it, then download, copy or share.",
  },
  {
    icon: "🔐",
    title: "Sign in to keep it",
    text: "As a guest your notes live in this browser. Sign in with an emailed code and everything you made is moved to your account, so it follows you across devices.",
  },
  {
    icon: "🎨",
    title: "Make it yours",
    text: "Account → Theme switches between Pixel, Pixel Dark, Light, Dark and System. Shuffle your generated avatar while you're there.",
  },
];

const TIPS = [
  "The episode or recipe link is optional, but the AI reads it for extra context when your notes are short.",
  "Same illustration style + seed always gives the same picture, so a saved cover stays stable.",
  "Search matches titles, sources and tags. Tags come from the AI but you can add your own.",
  "On phones, the system back gesture returns you to the list instead of leaving the app.",
];
</script>

<template>
  <BottomSheet :open="open" :title="firstRun ? 'Welcome to Summary Hub' : 'How to use Summary Hub'" wide @close="emit('close')">
    <div class="help stack">
      <p class="muted lede">
        Turn messy podcast notes and tasting notes into crisp, shareable summary cards, with free AI doing the tidying.
      </p>

      <ol class="steps">
        <li v-for="(s, i) in STEPS" :key="s.title" class="step">
          <span class="num" aria-hidden="true">{{ i + 1 }}</span>
          <span class="ic" aria-hidden="true">{{ s.icon }}</span>
          <div class="grow">
            <h3>{{ s.title }}</h3>
            <p class="small muted">{{ s.text }}</p>
          </div>
        </li>
      </ol>

      <section class="tips">
        <h3>Good to know</h3>
        <ul>
          <li v-for="t in TIPS" :key="t" class="small">{{ t }}</li>
        </ul>
      </section>

      <div class="row wrap cta">
        <button class="magic grow" @click="emit('start', 'podcast')">🎙️ Start a podcast summary</button>
        <button class="grow" @click="emit('start', 'food')">🍜 Start a food summary</button>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.help {
  gap: 1.1rem;
  padding-bottom: 0.5rem;
}
.lede {
  font-size: 1rem;
  line-height: 1.5;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}
@media (min-width: 720px) {
  .steps {
    grid-template-columns: 1fr 1fr;
  }
}
.step {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.85rem 0.9rem;
  border-radius: var(--radius);
  background: var(--bg-sunken);
  border: var(--border-w) solid var(--line);
}
.num {
  flex: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand);
  color: var(--brand-fg);
  font-weight: 800;
  font-size: 0.8rem;
}
.ic {
  font-size: 1.3rem;
  line-height: 1.2;
}
.step h3 {
  font-size: 0.95rem;
  font-weight: 800;
  margin-bottom: 0.2rem;
}
.step p {
  line-height: 1.45;
}
.tips h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-bottom: 0.4rem;
}
.tips ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  line-height: 1.45;
}
.cta {
  margin-top: 0.25rem;
}
</style>
