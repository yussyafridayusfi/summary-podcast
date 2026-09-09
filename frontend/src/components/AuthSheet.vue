<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ApiError } from "../api/client";
import { useAuth } from "../composables/useAuth";
import { useToast } from "../composables/useToast";
import BottomSheet from "./BottomSheet.vue";

const props = defineProps<{ open: boolean; initialMode?: "signin" | "signup" }>();
const emit = defineEmits<{ (e: "close"): void; (e: "done", payload: { created: boolean; claimed: number }): void }>();

const { requestCode, verify } = useAuth();
const { success, error } = useToast();

type Step = "email" | "code";
const mode = ref<"signin" | "signup">(props.initialMode ?? "signin");
const step = ref<Step>("email");
const email = ref("");
const username = ref("");
const code = ref("");
const busy = ref(false);
const devCode = ref<string | null>(null);
const delivered = ref<"smtp" | "console" | null>(null);
const resendIn = ref(0);
const codeInput = ref<HTMLInputElement | null>(null);
let timer: number | undefined;

const emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()));
const usernameOk = computed(() => /^[a-z0-9_]{3,20}$/i.test(username.value.trim()));
const canSend = computed(() => emailOk.value && (mode.value === "signin" || usernameOk.value) && !busy.value);
const canVerify = computed(() => code.value.replace(/\D/g, "").length === 6 && !busy.value);

function reset() {
  step.value = "email";
  code.value = "";
  devCode.value = null;
  delivered.value = null;
  busy.value = false;
  stopTimer();
}
watch(
  () => props.open,
  (o) => {
    if (o) {
      mode.value = props.initialMode ?? "signin";
      reset();
    }
  },
);
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
function startTimer(s: number) {
  resendIn.value = s;
  stopTimer();
  timer = window.setInterval(() => {
    resendIn.value -= 1;
    if (resendIn.value <= 0) stopTimer();
  }, 1000);
}
onBeforeUnmount(stopTimer);

async function send() {
  if (!canSend.value) return;
  busy.value = true;
  try {
    const r = await requestCode(mode.value, email.value.trim(), username.value.trim() || undefined);
    devCode.value = r.devCode ?? null;
    delivered.value = r.delivered ?? null;
    startTimer(r.resendIn);
    step.value = "code";
    code.value = "";
    await nextTick();
    codeInput.value?.focus();
  } catch (e) {
    if (e instanceof ApiError && e.code === "EXISTS") {
      mode.value = "signin";
      error(e.message);
    } else {
      error(e instanceof Error ? e.message : "Could not send the code");
    }
  } finally {
    busy.value = false;
  }
}

async function confirm() {
  if (!canVerify.value) return;
  busy.value = true;
  try {
    const r = await verify(email.value.trim(), code.value);
    success(
      r.created
        ? `Welcome, ${r.user.username}!`
        : `Signed in as ${r.user.username}${r.claimed ? ` · ${r.claimed} guest summar${r.claimed === 1 ? "y" : "ies"} moved to your account` : ""}`,
    );
    emit("done", { created: r.created, claimed: r.claimed });
    emit("close");
  } catch (e) {
    error(e instanceof Error ? e.message : "Verification failed");
    if (e instanceof ApiError && (e.code === "EXPIRED" || e.code === "LOCKED")) step.value = "email";
  } finally {
    busy.value = false;
  }
}

function onCodeInput(ev: Event) {
  const v = (ev.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 6);
  code.value = v;
  if (v.length === 6) confirm();
}
</script>

<template>
  <BottomSheet :open="open" :title="mode === 'signup' ? 'Create account' : 'Sign in'" @close="emit('close')">
    <div class="auth stack">
      <div v-if="step === 'email'" class="seg" role="radiogroup" aria-label="Mode">
        <button type="button" :class="{ on: mode === 'signin' }" @click="mode = 'signin'">Sign in</button>
        <button type="button" :class="{ on: mode === 'signup' }" @click="mode = 'signup'">Sign up</button>
      </div>

      <form v-if="step === 'email'" class="stack" @submit.prevent="send">
        <p class="muted small">
          No passwords. We email you a 6-digit code.
          <template v-if="mode === 'signup'">Pick a username to show on your account.</template>
        </p>
        <div v-if="mode === 'signup'" class="field">
          <label for="auth-username">Username</label>
          <input
            id="auth-username"
            v-model="username"
            autocomplete="username"
            placeholder="e.g. yussy_ch"
            maxlength="20"
            enterkeyhint="next"
          />
          <span v-if="username && !usernameOk" class="small err">3-20 letters, numbers or underscores.</span>
        </div>
        <div class="field">
          <label for="auth-email">Email</label>
          <input
            id="auth-email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            enterkeyhint="send"
          />
        </div>
        <button type="submit" class="primary" :disabled="!canSend">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? "Sending…" : mode === "signup" ? "Send sign-up code" : "Send sign-in code" }}
        </button>
      </form>

      <form v-else class="stack" @submit.prevent="confirm">
        <p class="muted small">
          We sent a code to <strong>{{ email }}</strong>.
          <button type="button" class="link" @click="step = 'email'">Change</button>
        </p>

        <div v-if="devCode" class="devcode">
          <span class="chip success">DEV</span>
          <span>No mail server configured. Your code is <strong class="mono">{{ devCode }}</strong></span>
          <button type="button" class="sm" @click="code = devCode!; confirm()">Use it</button>
        </div>

        <div class="field">
          <label for="auth-code">6-digit code</label>
          <input
            id="auth-code"
            ref="codeInput"
            :value="code"
            class="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="••••••"
            @input="onCodeInput"
          />
        </div>
        <button type="submit" class="primary" :disabled="!canVerify">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? "Checking…" : mode === "signup" ? "Create account" : "Sign in" }}
        </button>
        <button type="button" class="ghost" :disabled="resendIn > 0 || busy" @click="send">
          {{ resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code" }}
        </button>
      </form>
    </div>
  </BottomSheet>
</template>

<style scoped>
.auth {
  gap: 1rem;
  padding-bottom: 0.5rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.err {
  color: var(--danger);
}
.link {
  all: unset;
  color: var(--brand);
  cursor: pointer;
  font-weight: 600;
  margin-left: 0.25rem;
}
.code {
  font-size: 1.8rem;
  letter-spacing: 0.5em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.devcode {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-radius: var(--radius-s);
  background: var(--success-soft);
  border: 1px dashed var(--success);
  font-size: 0.9rem;
}
.devcode .mono {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.15em;
  font-size: 1.1rem;
}
.devcode span:nth-child(2) {
  flex: 1;
  min-width: 0;
}
</style>
