import type { Entry, EntryData, Schema } from '@cms/shared'

// In dev, requests go through the Vite proxy (see vite.config.ts). VITE_API_URL
// overrides the base for non-proxied/prod use.
const BASE = import.meta.env.VITE_API_URL ?? ''

// Abort a request that stalls instead of hanging on the browser default (~300s).
// A stalled fetch is what leaves the Save button stuck on "Saving…".
const DEFAULT_TIMEOUT_MS = 10_000

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out: ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `POST ${path} failed: ${res.status}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `PATCH ${path} failed: ${res.status}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await request(path, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `DELETE ${path} failed: ${res.status}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

// --- Schema helpers ---

export function listSchemas(): Promise<Schema[]> {
  return apiGet<{ data: Schema[] }>('/api/schemas').then((r) => r.data)
}

export function getSchema(id: string): Promise<Schema | null> {
  return apiGet<{ data: Schema }>(`/api/schemas/${id}`).then((r) => r.data)
}

// --- Entry helpers ---

export function listEntriesBySchemaId(schemaId: string): Promise<Entry[]> {
  return apiGet<{ data: Entry[] }>(`/api/entries?schemaId=${encodeURIComponent(schemaId)}`).then((r) => r.data)
}

export function getEntry(id: string): Promise<Entry> {
  return apiGet<{ data: Entry }>(`/api/entries/${id}`).then((r) => r.data)
}

export function createEntry(schemaId: string, data: EntryData): Promise<Entry> {
  return apiPost<Entry>('/api/entries', { schemaId, data })
}

export function updateEntry(id: string, data: EntryData): Promise<Entry> {
  return apiPatch<Entry>(`/api/entries/${id}`, { data })
}

export function deleteEntry(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/entries/${id}`)
}
