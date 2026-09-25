import { supabase } from "@/integrations/supabase/client";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Request-Id", requestId());
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
    if (!response.ok) {
      let body: { code?: string; message?: string } = {};
      try { body = await response.json(); } catch { /* non-JSON error */ }
      throw new ApiError(response.status, body.code || "API_ERROR", body.message || `Erro HTTP ${response.status}`);
    }
    if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError(408, "API_TIMEOUT", "A API demorou demais para responder.");
    throw error;
  } finally { clearTimeout(timer); }
}

// Alias temporário para os módulos criados durante a migração.
// Mantém uma única implementação HTTP e evita duplicação.
export const apiClient = apiRequest;
