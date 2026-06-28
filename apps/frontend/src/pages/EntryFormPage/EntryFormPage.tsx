import { EntryForm } from '@/components/EntryForm/EntryForm'
import { useSchemaStale } from '@/hooks/useSchemaStale'
import { createEntry, updateEntry } from '@/lib/api'
import { entryQueryOptions, schemaQueryOptions } from '@/lib/queries'
import type { EntryData } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { pageShellStyles } from './EntryFormPage.style'

export default function EntryFormPage() {
  const { schemaId, entryId } = useParams<{ schemaId: string; entryId: string }>()
  const isEdit = !!entryId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: schema, isLoading: schemaLoading } = useQuery(schemaQueryOptions(schemaId, queryClient))

  const { isStale: isSchemaStale, markCurrent: handleReloadSchema } = useSchemaStale(schema)

  const { data: existingEntry, isLoading: entryLoading } = useQuery(
    entryQueryOptions(schemaId, isEdit ? entryId : undefined, queryClient)
  )

  // List/entry refetch is driven by the socket echo (useRealtimeSync) — the single
  // source of truth — so onSuccess only navigates. This avoids the double refetch
  // (mutation + socket) that added latency to every write.
  const createMutation = useMutation({
    mutationFn: (data: EntryData) => createEntry(schemaId as string, data),
    onSuccess: () => {
      navigate(`/schemas/${schemaId}/entries`)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: EntryData) => updateEntry(entryId as string, data),
    onSuccess: () => {
      navigate(`/schemas/${schemaId}/entries`)
    }
  })

  async function onSave(data: EntryData) {
    if (isEdit) {
      await updateMutation.mutateAsync(data)
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error?.message ?? updateMutation.error?.message
  const isLoading = schemaLoading || (isEdit && entryLoading)

  if (isLoading) {
    return (
      <main css={pageShellStyles}>
        <p>Loading...</p>
      </main>
    )
  }

  if (!schema) {
    return (
      <main css={pageShellStyles}>
        <p className="text-sm text-red-700">Schema not found.</p>
      </main>
    )
  }

  return (
    <main css={pageShellStyles}>
      <button
        type="button"
        onClick={() => navigate(`/schemas/${schemaId}/entries`)}
        className="mb-4 text-xs text-slate-500 hover:text-slate-700 hover:underline"
      >
        ← Back to entries
      </button>

      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-950">
        {isEdit ? 'Edit entry' : `New ${schema.displayName} entry`}
      </h1>

      <EntryForm
        schema={schema}
        entry={existingEntry}
        onSave={onSave}
        onCancel={() => navigate(`/schemas/${schemaId}/entries`)}
        isPending={isPending}
        error={mutationError}
        isSchemaStale={isSchemaStale}
        onReloadSchema={handleReloadSchema}
      />
    </main>
  )
}
