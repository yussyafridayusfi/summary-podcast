<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { api, type ProviderInfo, type Summary, type SummaryInput } from "./api/client";
import { getOrCreateUserId } from "./api/user";
import AccountSheet from "./components/AccountSheet.vue";
import AuthSheet from "./components/AuthSheet.vue";
import Avatar from "./components/Avatar.vue";
import BottomNav from "./components/BottomNav.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ExportSheet from "./components/ExportSheet.vue";
import SummaryForm from "./components/SummaryForm.vue";
import SummaryList from "./components/SummaryList.vue";
import SummaryView from "./components/SummaryView.vue";
import Toast from "./components/Toast.vue";
import { useAuth } from "./composables/useAuth";
import { DESKTOP_QUERY, useMedia } from "./composables/useMedia";
import { useTheme } from "./composables/useTheme";
import { useToast } from "./composables/useToast";
import { isKind, SECTION_LIST, SECTIONS, type Kind } from "./lib/sections";

const { success, error: toastError, toast } = useToast();
const isDesktop = useMedia(DESKTOP_QUERY);
const { user, isSignedIn, boot } = useAuth();
const { theme, setTheme } = useTheme();

/* ----------------------------------------------------------- sections */
const KIND_KEY = "summary-hub:kind";
function loadKind(): Kind {
  try {
    const v = localStorage.getItem(KIND_KEY);
    return isKind(v) ? v : "podcast";
  } catch {
    return "podcast";
  }
}
const kind = ref<Kind>(loadKind());
const section = computed(() => SECTIONS[kind.value]);

/* ----------------------------------------------------------- data */
const guestId = ref("");
const items = ref<Summary[]>([]);
const selectedId = ref<string | null>(null);
const mode = ref<"view" | "edit" | "create">("view");
/** Mobile-only: which pane is on screen. Desktop always shows both. */
const pane = ref<"list" | "detail">("list");
const loading = ref(true);
const submitting = ref(false);
const providers = ref<ProviderInfo | null>(null);
const exportOpen = ref(false);
const accountOpen = ref(false);
const authOpen = ref(false);
const authMode = ref<"signin" | "signup">("signin");
const confirmDelete = ref<string | null>(null);

const selected = computed<Summary | null>(
  () => items.value.find((s) => s.id === selectedId.value) ?? null,
);

async function refresh() {
  loading.value = true;
  try {
    const { items: list } = await api.list(kind.value);
    items.value = list;
    if (selectedId.value && !list.some((s) => s.id === selectedId.value)) selectedId.value = null;
    if (!selectedId.value && list.length && isDesktop.value) selectedId.value = list[0].id;
  } catch (e) {
    toastError((e as Error).message);
  } finally {
    loading.value = false;
  }
}

function switchKind(k: Kind) {
  if (k === kind.value) return;
  kind.value = k;
  try {
    localStorage.setItem(KIND_KEY, k);
  } catch {
    /* ignore */
  }
  selectedId.value = null;
  mode.value = "view";
  pane.value = "list";
  refresh();
}

function select(id: string) {
  selectedId.value = id;
  mode.value = "view";
  pane.value = "detail";
}

function startNew() {
  selectedId.value = null;
  mode.value = "create";
  pane.value = "detail";
}

function startEdit() {
  if (selected.value) mode.value = "edit";
}

function cancelForm() {
  mode.value = "view";
  if (!selected.value) pane.value = "list";
}

function back() {
  pane.value = "list";
  mode.value = "view";
}

async function onSubmit(input: SummaryInput) {
  submitting.value = true;
  try {
    const payload = { ...input, kind: kind.value };
    if (mode.value === "create" || !selected.value) {
      const created = await api.create(payload);
      items.value = [created, ...items.value];
      selectedId.value = created.id;
      success("Summary created");
    } else {
      const updated = await api.update(selected.value.id, payload);
      items.value = items.value.map((s) => (s.id === updated.id ? updated : s));
      success("Changes saved");
    }
    mode.value = "view";
    pane.value = "detail";
  } catch (e) {
    toastError((e as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function doDelete() {
  const id = confirmDelete.value;
  confirmDelete.value = null;
  if (!id) return;
  try {
    await api.remove(id);
    items.value = items.value.filter((s) => s.id !== id);
    if (selectedId.value === id) {
      selectedId.value = isDesktop.value ? (items.value[0]?.id ?? null) : null;
      pane.value = "list";
    }
    mode.value = "view";
    success("Summary deleted");
  } catch (e) {
    toastError((e as Error).message);
  }
}

async function saveCover(p: { coverStyle: string; coverSeed: number }) {
  if (!selected.value) return;
  try {
    const updated = await api.patch(selected.value.id, p);
    items.value = items.value.map((s) => (s.id === updated.id ? updated : s));
    success("Cover saved");
  } catch (e) {
    toastError((e as Error).message);
  }
}

/* ----------------------------------------------------------- auth */
function openAuth(m: "signin" | "signup") {
  authMode.value = m;
  accountOpen.value = false;
  authOpen.value = true;
}
function onAuthDone() {
  // Guest rows may have been claimed; reload the current section.
  refresh();
}
function onExpired() {
  toast("Your session expired. Sign in again to sync.", "info");
  refresh();
}

/* ----------------------------------------------------------- nav */
// Android/iOS back gesture: pop to the list instead of leaving the app.
watch(pane, (p) => {
  if (!isDesktop.value && p === "detail") history.pushState({ pane: "detail" }, "");
});
function onPop() {
  if (!isDesktop.value && pane.value === "detail") {
    pane.value = "list";
    mode.value = "view";
  }
}

onMounted(async () => {
  guestId.value = getOrCreateUserId();
  window.addEventListener("popstate", onPop);
  window.addEventListener("auth:expired", onExpired);
  await boot();
  await refresh();
  api.ai
    .providers()
    .then((p) => (providers.value = p))
    .catch(() => {});
});
onBeforeUnmount(() => {
  window.removeEventListener("popstate", onPop);
  window.removeEventListener("auth:expired", onExpired);
});

const showList = computed(() => isDesktop.value || pane.value === "list");
const showDetail = computed(() => isDesktop.value || pane.value === "detail");
const quickTheme = () => setTheme(theme.value === "dark" ? "light" : theme.value === "light" ? "pixel" : theme.value === "pixel" ? "system" : "dark");
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="brand">
        <span class="logo" aria-hidden="true">{{ section.icon }}</span>
        <span class="title">{{ section.title }}</span>
      </div>

      <nav v-if="isDesktop" class="seg sections" aria-label="Sections">
        <button
          v-for="s in SECTION_LIST"
          :key="s.id"
          type="button"
          :class="{ on: kind === s.id }"
          @click="switchKind(s.id)"
        >
          {{ s.icon }} {{ s.label }}
        </button>
      </nav>

      <button v-if="isDesktop" class="primary sm" @click="startNew">+ New</button>
      <button class="icon ghost" :title="`Theme: ${theme}`" aria-label="Cycle theme" @click="quickTheme">
        {{ theme === "dark" ? "🌙" : theme === "light" ? "☀️" : theme === "pixel" ? "👾" : "🖥️" }}
      </button>
      <button v-if="isDesktop || true" class="account-btn" :title="user ? `@${user.username}` : 'Account'" @click="accountOpen = true">
        <Avatar v-if="user" :style="user.avatarStyle" :seed="user.avatarSeed" :name="user.username" :size="32" />
        <span v-else class="guest">Sign in</span>
        <span v-if="user && isDesktop" class="uname">@{{ user.username }}</span>
      </button>
    </header>

    <main class="main" :class="{ 'has-nav': !isDesktop }">
      <div class="layout">
        <div class="pane-list" :class="{ 'pane-hidden': !showList }">
          <SummaryList
            :items="items"
            :selected-id="selectedId"
            :loading="loading"
            :section="section"
            @select="select"
            @new="startNew"
          />
        </div>

        <div class="pane-detail" :class="{ 'pane-hidden': !showDetail }">
          <Transition name="pop" mode="out-in">
            <SummaryForm
              v-if="mode === 'create' || mode === 'edit'"
              :key="mode === 'edit' ? selected?.id : 'new'"
              :initial="mode === 'edit' ? selected : null"
              :submitting="submitting"
              :providers="providers"
              :section="section"
              @submit="onSubmit"
              @cancel="cancelForm"
            />

            <SummaryView
              v-else-if="selected"
              :key="selected.id"
              :summary="selected"
              :section="section"
              @edit="startEdit"
              @export="exportOpen = true"
              @delete="confirmDelete = selected.id"
              @back="back"
            />

            <section v-else-if="!loading" key="empty" class="card card-pad empty">
              <div class="empty-art" aria-hidden="true">{{ section.icon }}</div>
              <h2>{{ section.tagline }}</h2>
              <p class="muted">Pick a summary on the left, or start a new one.</p>
              <button class="magic" @click="startNew">+ New {{ section.label.toLowerCase() }} summary</button>
            </section>
          </Transition>
        </div>
      </div>
    </main>

    <Transition name="pop">
      <button v-if="pane === 'list' && !loading && !isDesktop" class="fab magic" @click="startNew">
        ✨ New
      </button>
    </Transition>

    <BottomNav v-if="!isDesktop" :kind="kind" :user="user" @select="switchKind" @account="accountOpen = true" />

    <ExportSheet
      :open="exportOpen"
      :summary="selected"
      :providers="providers"
      :section="section"
      @close="exportOpen = false"
      @save-cover="saveCover"
    />

    <AccountSheet
      :open="accountOpen"
      @close="accountOpen = false"
      @signin="openAuth('signin')"
      @signup="openAuth('signup')"
    />

    <AuthSheet :open="authOpen" :initial-mode="authMode" @close="authOpen = false" @done="onAuthDone" />

    <ConfirmDialog
      :open="confirmDelete !== null"
      title="Delete this summary?"
      message="This removes the notes, AI summary and cover settings. You can't undo it."
      confirm-label="Delete"
      danger
      @confirm="doDelete"
      @cancel="confirmDelete = null"
    />

    <Toast />
  </div>
</template>

<style scoped>
.sections {
  margin-inline: 0.5rem;
}
.account-btn {
  min-height: 40px;
  padding: 0.2rem 0.6rem 0.2rem 0.2rem;
  gap: 0.5rem;
  border-radius: 999px;
}
.account-btn .guest {
  padding-left: 0.5rem;
  font-size: 0.85rem;
}
.account-btn .uname {
  font-size: 0.85rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.main.has-nav {
  padding-bottom: calc(7.5rem + var(--safe-b));
}
.empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 3rem 1.5rem;
}
.empty-art {
  font-size: 2.4rem;
  width: 80px;
  height: 80px;
  display: grid;
  place-items: center;
  border-radius: 26px;
  background: var(--brand-soft);
}
.empty h2 {
  font-weight: 800;
  font-size: 1.2rem;
}
.empty button {
  margin-top: 0.5rem;
}
</style>
