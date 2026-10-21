import type { SyncPullResponse, SyncPushResponse } from "./types";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Sync request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as T;
}

export function pushSync(payload: unknown): Promise<SyncPushResponse> {
  return request<SyncPushResponse>("/v1/sync/push", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pullSync(since: string | null): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<SyncPullResponse>(`/v1/sync/pull${query}`);
}

export { API_URL };
