import { EntryForm } from '@/components/EntryForm/EntryForm'
import { createEntry, updateEntry } from '@/lib/api'
import { entryQueryOptions, queryKeys, schemaQueryOptions } from '@/lib/queries'
import type { EntryData, Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pageShellStyles } from './EntryFormPage.style'

export default function EntryFormPage() {
  const { schemaId, entryId } = useParams<{ schemaId: string; entryId: string }>()
  const isEdit = !!entryId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: schema, isLoading: schemaLoading } = useQuery(schemaQueryOptions(schemaId, queryClient))

  const renderedSchemaVersionRef = useRef<number | null>(null)
  const [isSchemaStale, setIsSchemaStale] = useState(false)

  useEffect(() => {
    if (schema && renderedSchemaVersionRef.current === null) {
      renderedSchemaVersionRef.current = schema.version
    }
  }, [schema])

  useEffect(() => {
    if (schema && renderedSchemaVersionRef.current !== null && schema.version > renderedSchemaVersionRef.current) {
      setIsSchemaStale(true)
    }
  }, [schema])

  function handleReloadSchema() {
    renderedSchemaVersionRef.current = schema?.version ?? null
    setIsSchemaStale(false)
  }

  const { data: existingEntry, isLoading: entryLoading } = useQuery(
    entryQueryOptions(schemaId, isEdit ? entryId : undefined, queryClient)
  )

  const createMutation = useMutation({
    mutationFn: (data: EntryData) => createEntry(schemaId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries(schemaId as string) })
      navigate(`/schemas/${schemaId}/entries`)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: EntryData) => updateEntry(entryId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries(schemaId as string) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entry(schemaId as string, entryId as string) })
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
