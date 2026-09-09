<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAuth } from "../composables/useAuth";
import { useTheme } from "../composables/useTheme";
import { useToast } from "../composables/useToast";
import { AVATAR_STYLES } from "../lib/avatar";
import Avatar from "./Avatar.vue";
import BottomSheet from "./BottomSheet.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void; (e: "signin"): void; (e: "signup"): void }>();

const { user, isSignedIn, updateProfile, signOut } = useAuth();
const { theme, themes, setTheme } = useTheme();
const { success, error } = useToast();

const editingName = ref(false);
const nameDraft = ref("");
const busy = ref(false);

watch(
  () => user.value?.username,
  (u) => (nameDraft.value = u ?? ""),
  { immediate: true },
);

const memberSince = computed(() =>
  user.value ? new Date(user.value.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "",
);

async function run<T>(fn: () => Promise<T>, okMsg?: string) {
  busy.value = true;
  try {
    const r = await fn();
    if (okMsg) success(okMsg);
    return r;
  } catch (e) {
    error(e instanceof Error ? e.message : "Something went wrong");
  } finally {
    busy.value = false;
  }
}

const saveName = () => {
  const n = nameDraft.value.trim();
  if (!n || n === user.value?.username) return (editingName.value = false);
  run(() => updateProfile({ username: n }), "Username updated").then(() => (editingName.value = false));
};
const pickStyle = (id: string) => run(() => updateProfile({ avatarStyle: id }));
const shuffle = () => run(() => updateProfile({ avatarSeed: "shuffle" }), "New look!");
const logout = () =>
  run(async () => {
    await signOut();
    emit("close");
  }, "Signed out");
</script>

<template>
  <BottomSheet :open="open" title="Account" @close="emit('close')">
    <div class="account stack">
      <!-- Signed-out -->
      <section v-if="!isSignedIn" class="hero card-pad">
        <div class="hero-art" aria-hidden="true">👋</div>
        <h3>You're browsing as a guest</h3>
        <p class="muted small">
          Your summaries live in this browser only. Sign in to keep them across devices and get a
          profile with a generated avatar.
        </p>
        <div class="row wrap actions">
          <button class="primary grow" @click="emit('signin')">Sign in</button>
          <button class="grow" @click="emit('signup')">Create account</button>
        </div>
      </section>

      <!-- Signed-in -->
      <section v-else class="profile">
        <div class="row profile-head">
          <Avatar :style="user!.avatarStyle" :seed="user!.avatarSeed" :name="user!.username" :size="72" />
          <div class="grow">
            <div v-if="!editingName" class="row">
              <strong class="uname">@{{ user!.username }}</strong>
              <button class="icon ghost sm" aria-label="Edit username" @click="editingName = true">✏️</button>
            </div>
            <form v-else class="row" @submit.prevent="saveName">
              <input v-model="nameDraft" maxlength="20" autofocus aria-label="Username" />
              <button type="submit" class="sm primary" :disabled="busy">Save</button>
            </form>
            <div class="small muted">{{ user!.email }}</div>
            <div class="small muted">Member since {{ memberSince }}</div>
          </div>
        </div>

        <div class="ctl">
          <div class="row between">
            <label>Generated avatar</label>
            <button class="sm" :disabled="busy" @click="shuffle">🎲 Shuffle</button>
          </div>
          <div class="styles">
            <button
              v-for="s in AVATAR_STYLES"
              :key="s.id"
              type="button"
              class="style"
              :class="{ on: user!.avatarStyle === s.id }"
              :title="s.hint"
              :disabled="busy"
              @click="pickStyle(s.id)"
            >
              <Avatar :style="s.id" :seed="user!.avatarSeed" :size="40" />
              <span>{{ s.label }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Theme (for everyone) -->
      <section class="ctl">
        <label>Theme</label>
        <div class="themes">
          <button
            v-for="t in themes"
            :key="t.id"
            type="button"
            class="theme"
            :class="{ on: theme === t.id }"
            :title="t.hint"
            @click="setTheme(t.id)"
          >
            <span class="emoji" aria-hidden="true">{{ t.icon }}</span>
            <span>{{ t.label }}</span>
          </button>
        </div>
        <p class="small muted">Pixel is a retro 8-bit skin. Your choice is remembered on this device.</p>
      </section>

      <button v-if="isSignedIn" class="danger" :disabled="busy" @click="logout">Sign out</button>
    </div>
  </BottomSheet>
</template>

<style scoped>
.account {
  gap: 1.25rem;
  padding-bottom: 0.5rem;
}
.hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--radius);
  background: var(--bg-sunken);
}
.hero-art {
  font-size: 2.2rem;
}
.hero h3 {
  font-weight: 800;
}
.actions {
  width: 100%;
  margin-top: 0.5rem;
}
.profile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.profile-head {
  gap: 1rem;
  align-items: center;
}
.uname {
  font-size: 1.15rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ctl {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.styles,
.themes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}
.style,
.theme {
  flex-direction: column;
  gap: 0.3rem;
  min-height: 74px;
  border-radius: 14px;
  font-size: 0.75rem;
  padding: 0.5rem 0.25rem;
  white-space: normal;
}
.style.on,
.theme.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: 0 0 0 3px rgb(109 74 255 / 0.15);
}
.theme .emoji {
  font-size: 1.4rem;
}
@media (max-width: 420px) {
  .styles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
