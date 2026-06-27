import { apiGet } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

// M0 wiring proof: hits the backend /health through the Vite proxy and renders status.
// No features — M1+ add real routes under the Router already mounted in main.tsx.
export function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<{ ok: boolean }>('/health')
  })

  const status = isLoading ? 'checking…' : isError ? 'error' : data?.ok ? 'ok' : 'unknown'

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Headless CMS Admin</h1>
      <p>
        backend: <strong>{status}</strong>
      </p>
    </main>
  )
}
