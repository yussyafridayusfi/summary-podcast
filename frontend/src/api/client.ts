import { getOrCreateUserId } from "./user";

export interface Summary {
  id: string;
  userId: string;
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryInput {
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  content?: string;
}

const BASE = "/api/summaries";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
  remove: (id: string) => request<void>(`/${id}`, { method: "DELETE" }),
};
