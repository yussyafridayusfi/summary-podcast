import { getOrCreateUserId } from "./user";

export interface Summary {
  id: string;
  userId: string;
  type: "podcast" | "food-review";
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  guest: string | null;
  content: string;
  summaryGeneratorText: string;
  imageDataUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryInput {
  type?: "podcast" | "food-review";
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  guest?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

export interface FoodReview {
  id: string;
  userId: string;
  restoName: string;
  description: string | null;
  /** Calendar day, YYYY-MM-DD. */
  dateVisit: string | null;
  location: string | null;
  urlWebResto: string | null;
  content: string;
  summaryGeneratorText: string;
  imageDataUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodReviewInput {
  restoName: string;
  description?: string | null;
  dateVisit?: string | null;
  location?: string | null;
  urlWebResto?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

const BASE = "/api/summaries";
const FOOD_BASE = "/api/food-reviews";

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
  list: (type?: "podcast" | "food-review") => request<{ items: Summary[] }>(type ? `?type=${type}` : ""),
  get: (id: string) => request<Summary>(`/${id}`),
  create: (input: SummaryInput) =>
    request<Summary>("", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: SummaryInput) =>
    request<Summary>(`/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  patch: (id: string, input: Partial<SummaryInput>) =>
    request<Summary>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/${id}`, { method: "DELETE" }),
};

export const foodApi = {
  list: () => requestAt<{ items: FoodReview[] }>(FOOD_BASE),
  get: (id: string) => requestAt<FoodReview>(`${FOOD_BASE}/${id}`),
  create: (input: FoodReviewInput) =>
    requestAt<FoodReview>(FOOD_BASE, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: FoodReviewInput) =>
    requestAt<FoodReview>(`${FOOD_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  patch: (id: string, input: Partial<FoodReviewInput>) =>
    requestAt<FoodReview>(`${FOOD_BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    requestAt<void>(`${FOOD_BASE}/${id}`, { method: "DELETE" }),
};

/**
 * Context the generator needs; mirrors the editable form state. Discriminated
 * on `type` because podcasts and food reviews share no descriptive fields.
 */
export interface PodcastGenerateContext {
  type?: "podcast";
  podcastName: string;
  sessionTitle: string;
  guest?: string | null;
  url?: string | null;
  content?: string;
  imageDataUri?: string | null;
}

export interface FoodGenerateContext {
  type: "food-review";
  restoName: string;
  description?: string | null;
  dateVisit?: string | null;
  location?: string | null;
  urlWebResto?: string | null;
  content?: string;
  imageDataUri?: string | null;
}

export type GenerateContext = PodcastGenerateContext | FoodGenerateContext;

/** The name an exported file is saved under, per context kind. */
export function contextFilename(ctx: GenerateContext): string {
  return ctx.type === "food-review"
    ? `${ctx.restoName} ${ctx.description ?? ""}`.trim()
    : `${ctx.podcastName} ${ctx.sessionTitle}`.trim();
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

  /** Text slots for the food IMG card; the layout is composed client-side. */
  foodCard: (ctx: FoodGenerateContext) =>
    requestAt<{
      card: {
        title: string;
        tagline: string;
        labels: string[];
        body: string;
        query: string;
        suggestion: string;
      };
      provider: string;
      model: string;
    }>("/api/ai/food-card", { method: "POST", body: JSON.stringify(ctx) }),

  image: (prompt: string, seed?: number) =>
    requestAt<{ dataUri: string; bytes: number; contentType: string }>(
      "/api/ai/image",
      { method: "POST", body: JSON.stringify({ prompt, seed }) },
    ),
};
