import { computed, ref } from "vue";
import { api, ApiError, type AuthUser } from "../api/client";
import { getOrCreateUserId } from "../api/user";

/** Global auth state: the signed-in user and whether we've checked yet. */
const user = ref<AuthUser | null>(null);
const ready = ref(false);
let bootPromise: Promise<void> | null = null;

export function useAuth() {
  const isSignedIn = computed(() => user.value !== null);

  /** Validate a stored token once per page load. */
  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      if (!api.auth.token()) {
        ready.value = true;
        return;
      }
      try {
        const { user: u } = await api.auth.me();
        user.value = u;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) api.auth.setToken(null);
      } finally {
        ready.value = true;
      }
    })();
    return bootPromise;
  }

  async function requestCode(mode: "signin" | "signup", email: string, username?: string) {
    return api.auth.requestCode({ mode, email, username });
  }

  /** Verify the code; guest summaries are claimed into the account. */
  async function verify(email: string, code: string) {
    const res = await api.auth.verify({ email, code, guestId: getOrCreateUserId() });
    api.auth.setToken(res.token);
    user.value = res.user;
    return res;
  }

  async function updateProfile(patch: { username?: string; avatarStyle?: string; avatarSeed?: string }) {
    const { user: u } = await api.auth.updateMe(patch);
    user.value = u;
    return u;
  }

  async function signOut() {
    try {
      await api.auth.logout();
    } catch {
      /* best effort */
    }
    api.auth.setToken(null);
    user.value = null;
  }

  return { user, ready, isSignedIn, boot, requestCode, verify, updateProfile, signOut };
}
