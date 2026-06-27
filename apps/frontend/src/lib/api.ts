// In dev, requests go through the Vite proxy (see vite.config.ts). VITE_API_URL
// overrides the base for non-proxied/prod use.
const BASE = import.meta.env.VITE_API_URL ?? ''

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
