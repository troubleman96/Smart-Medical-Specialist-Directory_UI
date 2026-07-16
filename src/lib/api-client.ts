const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: Record<string, string[]> | null;
  meta: {
    pagination?: {
      count: number;
      next: string | null;
      previous: string | null;
      page_size: number;
    };
  } | null;
}

interface TokenPair {
  access: string;
  refresh: string;
}

// The envelope's top-level `message` is a generic label ("Something went
// wrong.", "Validation failed.") — the actually useful text lives in
// `errors`, either {detail: "..."} for service-layer failures or
// {field: ["msg", ...]} for serializer validation. Prefer that.
function extractErrorMessage(body: ApiEnvelope<unknown>): string {
  const errors = body.errors as Record<string, unknown> | null;
  if (errors && typeof errors === "object") {
    if (typeof errors.detail === "string") return errors.detail;
    for (const key of Object.keys(errors)) {
      const val = errors[key];
      if (Array.isArray(val) && typeof val[0] === "string") {
        return key === "detail" ? val[0] : `${key}: ${val[0]}`;
      }
    }
  }
  return body.message || "Request failed";
}

const STORAGE_KEY = "kindamba_tokens";

function getTokens(): TokenPair | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: TokenPair) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getTokens()?.access ?? null;
}

export function getRefreshToken(): string | null {
  return getTokens()?.refresh ?? null;
}

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    // Unlike every other endpoint, /api/auth/refresh/ is DRF-simplejwt's stock
    // TokenRefreshView — it returns a raw { access, refresh } body, not our envelope.
    const body: { access?: string } = await res.json();
    if (!body.access) return false;
    const existing = getTokens();
    if (existing) setTokens({ access: body.access, refresh: existing.refresh });
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers);

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      const ok = await refreshAccessToken();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb());
      refreshQueue = [];
      if (ok) {
        const newToken = getAccessToken();
        if (newToken) {
          headers.set("Authorization", `Bearer ${newToken}`);
          res = await fetch(url, { ...options, headers });
        }
      } else {
        clearTokens();
        window.location.href = "/auth";
        throw new Error("Session expired");
      }
    } else {
      await new Promise<void>((resolve) => refreshQueue.push(resolve));
      const newToken = getAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers });
      }
    }
  }

  const body: ApiEnvelope<T> = await res.json();

  if (!body.success) {
    const err = new Error(extractErrorMessage(body)) as Error & { errors: Record<string, string[]> | null };
    err.errors = body.errors;
    throw err;
  }

  return body.data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

export function apiPatch<T>(path: string, data: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

export interface PaginatedData<T> {
  items: T[];
  meta: {
    count: number;
    next: string | null;
    previous: string | null;
    page_size: number;
  } | null;
}

export async function apiGetPaginated<T>(path: string, params?: Record<string, string | number | undefined>): Promise<PaginatedData<T>> {
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });
  const body: ApiEnvelope<T[]> = await res.json();

  if (!body.success) {
    throw new Error(extractErrorMessage(body));
  }

  return { items: body.data, meta: body.meta };
}
