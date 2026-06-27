import { apiGet, createEntry, getEntry, listEntries, updateEntry } from '@/lib/api'
import type { Entry, EntryData, Field, Schema } from '@cms/shared'
import { buildZodSchema } from '@cms/shared'
import { css } from '@emotion/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

const pageShellStyles = css({
  maxWidth: 640,
  margin: '0 auto',
  padding: 32
})

const fieldGroupStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  marginBottom: 24
})

const fieldRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: 8
})

const formActionsStyles = css({
  display: 'flex',
  gap: 12,
  marginTop: 24
})

const inputClassName =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

const labelClassName = 'mb-1 block text-xs font-semibold text-slate-600'

interface ReferenceSelectProps {
  field: Field
  value: string
  onChange: (v: string) => void
  onViewClick: (schemaId: string, entryId: string) => void
}

function ReferenceSelect({ field, value, onChange, onViewClick }: ReferenceSelectProps) {
  const { data: refEntries = [], isLoading } = useQuery({
    queryKey: ['entries-for-ref', field.referenceSchemaId],
    queryFn: async () => {
      if (!field.referenceSchemaId) return []
      // Fetch the referenced schema to get its slug
      const schemas = await apiGet<{ data: Schema[] }>('/api/schemas').then((r) => r.data as unknown as Schema[])
      const refSchema = schemas.find((s) => s.id === field.referenceSchemaId)
      if (!refSchema) return []
      const entries = await listEntries(refSchema.slug)
      return entries.map((e) => ({ entry: e, schema: refSchema }))
    },
    enabled: !!field.referenceSchemaId
  })

  return (
    <div css={fieldRowStyles}>
      <div className="flex-1">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
          disabled={isLoading}
        >
          <option value="">— select —</option>
          {refEntries.map(({ entry, schema }) => {
            const firstField = schema.fields[0]
            const label = firstField
              ? String((entry.data as Record<string, unknown>)[firstField.id] ?? entry.id)
              : entry.id
            return (
              <option key={entry.id} value={entry.id}>
                {label}
              </option>
            )
          })}
        </select>
      </div>
      {value && field.referenceSchemaId && (
        <button
          type="button"
          onClick={() => onViewClick(field.referenceSchemaId as string, value)}
          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          title="View referenced entry"
        >
          ↗ View
        </button>
      )}
    </div>
  )
}

function renderFieldControl(
  field: Field,
  // biome-ignore lint/suspicious/noExplicitAny: RHF register is polymorphic
  register: ReturnType<typeof useForm<any>>['register'],
  // biome-ignore lint/suspicious/noExplicitAny: RHF watch is polymorphic
  watch: ReturnType<typeof useForm<any>>['watch'],
  // biome-ignore lint/suspicious/noExplicitAny: RHF setValue is polymorphic
  setValue: ReturnType<typeof useForm<any>>['setValue'],
  navigate: ReturnType<typeof useNavigate>
) {
  const fieldKey = field.id

  switch (field.type) {
    case 'text':
      return <input type="text" {...register(fieldKey)} className={inputClassName} />

    case 'number':
      return (
        <input type="number" step="any" {...register(fieldKey, { valueAsNumber: true })} className={inputClassName} />
      )

    case 'boolean':
      return <input type="checkbox" {...register(fieldKey)} className="h-4 w-4 accent-blue-600" />

    case 'date':
      return <input type="date" {...register(fieldKey)} className={inputClassName} />

    case 'reference': {
      const currentVal = (watch(fieldKey) as string) ?? ''
      return (
        <ReferenceSelect
          field={field}
          value={currentVal}
          onChange={(v) => setValue(fieldKey, v, { shouldDirty: true })}
          onViewClick={(refSchemaId, entryId) => navigate(`/schemas/${refSchemaId}/entries/${entryId}/edit`)}
        />
      )
    }

    default:
      return <input type="text" {...register(fieldKey)} className={inputClassName} />
  }
}

export default function EntryFormPage() {
  const { schemaId, entryId } = useParams<{ schemaId: string; entryId: string }>()
  const isEdit = !!entryId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['schema', schemaId],
    queryFn: () =>
      apiGet<{ data: Schema[] }>('/api/schemas').then((r) => {
        const list = r.data as unknown as Schema[]
        return list.find((s) => s.id === schemaId) ?? null
      }),
    enabled: !!schemaId
  })

  const { data: existingEntry, isLoading: entryLoading } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => getEntry(entryId as string),
    enabled: isEdit
  })

  // Build Zod schema only when fields are loaded
  const zodSchema = schema ? buildZodSchema(schema.fields) : null

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodSchema ? zodResolver(zodSchema) : undefined
  })

  // Populate form for edit mode
  useEffect(() => {
    if (isEdit && existingEntry && schema) {
      const defaults: Record<string, unknown> = {}
      for (const f of schema.fields) {
        const val = (existingEntry.data as Record<string, unknown>)[f.id]
        if (val !== undefined) defaults[f.id] = val
      }
      reset(defaults)
    }
  }, [existingEntry, schema, isEdit, reset])

  const createMutation = useMutation({
    mutationFn: (data: EntryData) => createEntry(schemaId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', schemaId] })
      navigate(`/schemas/${schemaId}/entries`)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: EntryData) => updateEntry(entryId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', schemaId] })
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      navigate(`/schemas/${schemaId}/entries`)
    }
  })

  function onSubmit(values: Record<string, unknown>) {
    // Map form values back to field.id keyed EntryData
    const data: EntryData = {}
    if (schema) {
      for (const f of schema.fields) {
        if (values[f.id] !== undefined) {
          data[f.id] = values[f.id]
        }
      }
    }

    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
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

      <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])}>
        <div css={fieldGroupStyles}>
          {schema.fields.map((field) => {
            const errMsg = (errors[field.id] as { message?: string } | undefined)?.message
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className={labelClassName}>
                  {field.key}
                  {field.required && <span className="ml-1 text-red-600">*</span>}
                  <span className="ml-2 font-normal text-slate-400">({field.type})</span>
                </label>
                {renderFieldControl(field, register, watch, setValue, navigate)}
                {errMsg && <p className="mt-1 text-xs text-red-600">{errMsg}</p>}
              </div>
            )
          })}
        </div>

        {mutationError && <p className="mb-3 text-sm text-red-700">Error: {mutationError}</p>}

        <div css={formActionsStyles}>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create entry'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/schemas/${schemaId}/entries`)}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  )
}
