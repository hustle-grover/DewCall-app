import { supabase } from './supabase'

// In development, Vite proxies /api/* to Railway (see vite.config.ts).
// In production, set VITE_API_URL to the full Railway origin.
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get:  <T>(path: string)                => request<T>('GET',    path),
  post: <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:  <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  del:  <T>(path: string)                => request<T>('DELETE', path),
}
