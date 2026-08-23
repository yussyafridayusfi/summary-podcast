import { getOrCreateUserId } from "./user";

export interface Summary {
  id: string;
  userId: string;
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  guest: string | null;
  content: string;
  summaryGeneratorText: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryInput {
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  guest?: string | null;
  content?: string;
  summaryGeneratorText?: string;
}

const BASE = "/api/summaries";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestAt(`${BASE}${path}`, init);
}

async function requestAt<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-user-id": getOrCreateUserId(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: () => request<{ items: Summary[] }>(""),
  get: (id: string) => request<Summary>(`/${id}`),
  create: (input: SummaryInput) =>
    request<Summary>("", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: SummaryInput) =>
    request<Summary>(`/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  patch: (id: string, input: Partial<SummaryInput>) =>
    request<Summary>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/${id}`, { method: "DELETE" }),
};

/** Context the generator needs; mirrors the editable form state. */
export interface GenerateContext {
  podcastName: string;
  sessionTitle: string;
  guest?: string | null;
  url?: string | null;
  content?: string;
}

export type ExportFormat = "img" | "pdf" | "html";

/** Which text the exported artefact is designed from. */
export type ExportSource = "notes" | "summary";

export interface AiStatus {
  textReady: boolean;
  provider: string | null;
  model: string | null;
  imageReady: boolean;
}

export const aiApi = {
  status: () => requestAt<AiStatus>("/api/ai/status"),

  summary: (ctx: GenerateContext) =>
    requestAt<{ text: string; provider: string; model: string }>(
      "/api/ai/summary",
      { method: "POST", body: JSON.stringify(ctx) },
    ),

  design: (
    ctx: GenerateContext & {
      format: ExportFormat;
      prompt: string;
      source: ExportSource;
      // Ignored by the backend when source is "notes".
      summaryText: string;
    },
  ) =>
    requestAt<{ html: string; provider: string; model: string }>(
      "/api/ai/design",
      { method: "POST", body: JSON.stringify(ctx) },
    ),

  image: (prompt: string, seed?: number) =>
    requestAt<{ dataUri: string; bytes: number; contentType: string }>(
      "/api/ai/image",
      { method: "POST", body: JSON.stringify({ prompt, seed }) },
    ),
};
