import { deleteEntry } from '@/lib/api'
import { entriesQueryOptions, queryKeys, schemaQueryOptions } from '@/lib/queries'
import type { Entry, Field, Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  entryActionsStyles,
  entryCardStyles,
  entryListStyles,
  pageHeaderStyles,
  pageShellStyles
} from './EntryListPage.style'

/** Summarise an entry's data using the first 3 fields resolved by field.key */
function summariseEntry(entry: Entry, fields: Field[]): string {
  const preview = fields
    .slice(0, 3)
    .map((f) => {
      const val = (entry.data as Record<string, unknown>)[f.id]
      if (val === undefined || val === null || val === '') return null
      return `${f.key}: ${val}`
    })
    .filter(Boolean)
    .join(' · ')
  return preview || '(empty)'
}

export default function EntryListPage() {
  const { schemaId } = useParams<{ schemaId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch schema to get displayName, slug, and fields
  const { data: schema, isLoading: schemaLoading } = useQuery(schemaQueryOptions(schemaId, queryClient))

  const {
    data: entryList = [],
    isLoading: entriesLoading,
    isError: entriesError
  } = useQuery(entriesQueryOptions(schemaId))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries(schemaId as string) })
    }
  })

  function handleDelete(entry: Entry) {
    if (!window.confirm('Delete this entry?')) return
    deleteMutation.mutate(entry.id)
  }

  const isLoading = schemaLoading || entriesLoading

  return (
    <main css={pageShellStyles}>
      <div css={pageHeaderStyles}>
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-950">
            {schema ? schema.displayName : 'Entries'}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/schemas')}
            className="mt-1 text-xs text-slate-500 hover:text-slate-700 hover:underline"
          >
            ← Back to schemas
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/schemas/${schemaId}/entries/new`)}
          className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          New Entry
        </button>
      </div>

      {isLoading && <p>Loading...</p>}

      {!isLoading && entriesError && <p className="text-sm text-red-700">Failed to load entries.</p>}

      {!isLoading && !entriesError && entryList.length === 0 && (
        <p className="text-sm text-slate-500">No entries yet. Create one.</p>
      )}

      {!isLoading && !entriesError && entryList.length > 0 && schema && (
        <ul css={entryListStyles}>
          {entryList.map((entry) => (
            <li key={entry.id} css={entryCardStyles}>
              <div>
                <p className="m-0 text-sm text-slate-700">{summariseEntry(entry, schema.fields)}</p>
                <p className="mt-0.5 text-xs text-slate-400">{entry.id}</p>
              </div>
              <div css={entryActionsStyles}>
                <button
                  type="button"
                  onClick={() => navigate(`/schemas/${schemaId}/entries/${entry.id}/edit`)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
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
