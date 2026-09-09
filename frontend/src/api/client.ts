import { getOrCreateUserId } from "./user";
import type { Kind } from "../lib/sections";

export interface Summary {
  id: string;
  userId: string;
  kind: Kind;
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  content: string;
  headline: string | null;
  aiSummary: string | null;
  takeaways: string[];
  quotes: string[];
  tags: string[];
  mood: string | null;
  coverPrompt: string | null;
  coverStyle: string | null;
  coverSeed: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryInput {
  kind?: Kind;
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  content?: string;
  headline?: string | null;
  aiSummary?: string | null;
  takeaways?: string[];
  quotes?: string[];
  tags?: string[];
  mood?: string | null;
  coverPrompt?: string | null;
  coverStyle?: string | null;
  coverSeed?: number | null;
}

export type Tone = "casual" | "professional" | "playful";

export interface SummarizeRequest {
  kind: Kind;
  podcastName: string;
  sessionTitle: string;
  notes: string;
  url?: string | null;
  language?: string;
  tone?: Tone;
}

export interface AiSummary {
  headline: string;
  summary: string;
  takeaways: string[];
  quotes: string[];
  tags: string[];
  mood: string;
  coverPrompt: string;
  suggestedStyle: string;
  provider: string;
  model: string;
  usedUrl: boolean;
}

export interface ProviderInfo {
  /** Only the anonymous fallback is configured; real summaries need a free key. */
  needsKey: boolean;
  /** Demo mode: summaries are assembled from notes without a model. */
  demo: boolean;
  text: {
    id: string;
    label: string;
    note: string;
    model: string;
    active: boolean;
    primary: boolean;
  }[];
  image: { id: string; label: string; note: string; available: boolean; primary: boolean }[];
  styles: { id: string; label: string; emoji: string }[];
}

export interface Stats {
  total: number;
  byKind: Record<Kind, number>;
  aiCount: number;
  withCover: number;
  thisWeek: number;
  takeaways: number;
  tags: { tag: string; count: number }[];
  recent: Summary[];
  lastUpdated: string | null;
}

export interface ImageParams {
  prompt: string;
  style: string;
  seed: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ auth */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatarStyle: string;
  avatarSeed: string;
  createdAt: string;
}

export interface AuthConfig {
  mailer: "smtp" | "console";
  devCodes: boolean;
  avatarStyles: string[];
}

export interface RequestCodeResult {
  ok: true;
  delivered?: "smtp" | "console";
  resendIn: number;
  /** Only present when the backend runs without SMTP outside production. */
  devCode?: string;
}

export interface VerifyResult {
  token: string;
  user: AuthUser;
  created: boolean;
  claimed: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "summary-hub:token";
let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}

function setToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-user-id": getOrCreateUserId(),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      details?: unknown;
    };
    if (res.status === 401 && body.code === "UNAUTHENTICATED" && token) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code, body.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: (kind?: Kind) => request<{ items: Summary[] }>(`/summaries${kind ? `?kind=${kind}` : ""}`),
  stats: () => request<Stats>("/summaries/stats"),
  get: (id: string) => request<Summary>(`/summaries/${id}`),
  create: (input: SummaryInput) =>
    request<Summary>("/summaries", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: SummaryInput) =>
    request<Summary>(`/summaries/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  patch: (id: string, input: Partial<SummaryInput>) =>
    request<Summary>(`/summaries/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/summaries/${id}`, { method: "DELETE" }),

  ai: {
    providers: () => request<ProviderInfo>("/ai/providers"),
    summarize: (input: SummarizeRequest) =>
      request<AiSummary>("/ai/summarize", { method: "POST", body: JSON.stringify(input) }),
    /** URL for an <img> or canvas. Same params always yield the same picture. */
    imageUrl: (p: ImageParams) => {
      const q = new URLSearchParams({
        prompt: p.prompt,
        style: p.style,
        seed: String(p.seed),
        w: String(p.w),
        h: String(p.h),
      });
      return `/api/ai/image?${q}`;
    },
  },

  auth: {
    token: () => token,
    setToken,
    config: () => request<AuthConfig>("/auth/config"),
    requestCode: (body: { mode: "signin" | "signup"; email: string; username?: string }) =>
      request<RequestCodeResult>("/auth/request-code", { method: "POST", body: JSON.stringify(body) }),
    verify: (body: { email: string; code: string; guestId?: string }) =>
      request<VerifyResult>("/auth/verify", { method: "POST", body: JSON.stringify(body) }),
    me: () => request<{ user: AuthUser }>("/auth/me"),
    updateMe: (patch: { username?: string; avatarStyle?: string; avatarSeed?: string }) =>
      request<{ user: AuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(patch) }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },
};
