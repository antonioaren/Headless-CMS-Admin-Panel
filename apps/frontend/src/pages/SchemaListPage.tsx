import { apiDelete, apiGet } from '@/lib/api'
import {
  pageHeaderStyles,
  pageShellStyles,
  schemaActionsStyles,
  schemaCardStyles,
  schemaListStyles
} from '@/pages/SchemaListPage.style'
import type { Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

export default function SchemaListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => apiGet<{ data: Schema[] }>('/api/schemas').then((r) => r.data)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<{ id: string }>(`/api/schemas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
    }
  })

  function handleDelete(schema: Schema) {
    if (!window.confirm(`Delete schema "${schema.displayName}" and all its entries?`)) return
    deleteMutation.mutate(schema.id)
  }

  return (
    <main css={pageShellStyles}>
      <div css={pageHeaderStyles}>
        <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-950">Content Schemas</h1>
        <button
          type="button"
          onClick={() => navigate('/schemas/new')}
          className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          New Schema
        </button>
      </div>

      {isLoading && <p>Loading...</p>}

      {!isLoading && data?.length === 0 && <p className="text-sm text-slate-500">No schemas yet. Create one.</p>}

      {data && data.length > 0 && (
        <ul css={schemaListStyles}>
          {data.map((schema) => (
            <li
              key={schema.id}
              css={schemaCardStyles}
              className="rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div>
                <strong className="text-base font-bold text-slate-950">{schema.displayName}</strong>
                <span className="ml-3 text-xs text-slate-500">
                  {schema.fields.length} {schema.fields.length === 1 ? 'field' : 'fields'}
                </span>
                <span className="ml-2 text-xs text-slate-400">v{schema.version}</span>
              </div>
              <div css={schemaActionsStyles}>
                <button
                  type="button"
                  onClick={() => navigate(`/schemas/${schema.id}/edit`)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(schema)}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
