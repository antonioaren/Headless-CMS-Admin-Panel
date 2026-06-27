import { EntryForm } from '@/components/EntryForm/EntryForm'
import { apiGet, getEntry, updateEntry } from '@/lib/api'
import type { Entry, EntryData, MigrationImpact, MigrationPlan, Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

interface RepairState {
  plan: MigrationPlan
}

function RepairEntryCard({
  entryId,
  schema,
  onDone
}: {
  entryId: string
  schema: Schema
  onDone: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => getEntry(entryId)
  })

  const updateMutation = useMutation({
    mutationFn: (data: EntryData) => updateEntry(entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      onDone()
    }
  })

  if (isLoading) return <p className="text-sm text-slate-500">Loading entry…</p>
  if (!entry) return <p className="text-sm text-red-600">Entry not found: {entryId}</p>

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <p className="mb-3 text-xs font-semibold text-amber-700">Entry ID: {entryId}</p>
      <EntryForm
        schema={schema}
        entry={entry}
        onSave={async (data) => {
          await updateMutation.mutateAsync(data)
        }}
        onCancel={() => navigate(`/schemas/${schema.id}/entries`)}
        isPending={updateMutation.isPending}
        error={updateMutation.error?.message}
        submitLabel="Save repair"
      />
    </div>
  )
}

export default function RepairPage() {
  const { id: schemaId } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as RepairState | null

  const [doneEntries, setDoneEntries] = useState<Set<string>>(new Set())

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['schema', schemaId],
    queryFn: () =>
      apiGet<{ data: Schema[] }>('/api/schemas').then((r) => {
        const list = r.data as unknown as Schema[]
        return list.find((s) => s.id === schemaId) ?? null
      }),
    enabled: !!schemaId
  })

  if (!state?.plan) {
    navigate('/schemas')
    return null
  }

  const plan = state.plan

  // Collect entry IDs that have at least one manual impact
  const manualEntryIds = [
    ...new Set(plan.impact.filter((i: MigrationImpact) => i.status === 'manual').map((i: MigrationImpact) => i.entryId))
  ]

  const remaining = manualEntryIds.filter((id) => !doneEntries.has(id))

  if (schemaLoading) {
    return (
      <main className="mx-auto max-w-2xl px-8 py-8">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    )
  }

  if (!schema) {
    return (
      <main className="mx-auto max-w-2xl px-8 py-8">
        <p className="text-sm text-red-600">Schema not found.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-8 py-8">
      <button
        type="button"
        onClick={() => navigate(`/schemas/${schemaId}/entries`)}
        className="mb-4 text-xs text-slate-500 hover:text-slate-700 hover:underline"
      >
        ← Back to entries
      </button>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-950">Manual Repairs Required</h1>
      <p className="mb-6 text-sm text-slate-600">
        The following entries could not be migrated automatically. Review and save each one.
      </p>

      {remaining.length === 0 ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-semibold text-emerald-700">All entries repaired.</p>
          <button
            type="button"
            onClick={() => navigate('/schemas')}
            className="mt-4 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Done — back to schemas
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {remaining.map((entryId) => (
            <RepairEntryCard
              key={entryId}
              entryId={entryId}
              schema={schema}
              onDone={() => setDoneEntries((prev) => new Set([...prev, entryId]))}
            />
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/schemas')}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              Skip remaining repairs
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
