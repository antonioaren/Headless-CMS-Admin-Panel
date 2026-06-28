import { apiGet, listEntries } from '@/lib/api'
import type { Entry, EntryData, Field, Schema } from '@cms/shared'
import { buildZodSchema } from '@cms/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { fieldGroupStyles, fieldRowStyles, formActionsStyles } from './EntryForm.style'

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

export interface EntryFormProps {
  schema: Schema
  entry?: Entry
  onSave: (data: EntryData) => Promise<void>
  onCancel: () => void
  isPending?: boolean
  error?: string
  submitLabel?: string
  isSchemaStale?: boolean
  onReloadSchema?: () => void
}

export function EntryForm({
  schema,
  entry,
  onSave,
  onCancel,
  isPending = false,
  error,
  submitLabel,
  isSchemaStale = false,
  onReloadSchema
}: EntryFormProps) {
  const navigate = useNavigate()
  const isEdit = !!entry

  const zodSchema = buildZodSchema(schema.fields)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(zodSchema)
  })

  // Populate form for edit mode
  useEffect(() => {
    if (isEdit && entry && schema) {
      const defaults: Record<string, unknown> = {}
      for (const f of schema.fields) {
        const val = (entry.data as Record<string, unknown>)[f.id]
        if (val !== undefined) {
          defaults[f.id] = val
        } else if (!f.required) {
          // Register optional absent fields explicitly so RHF tracks them and
          // the Zod preprocess receives the right empty value per type
          defaults[f.id] = f.type === 'number' ? undefined : ''
        }
      }
      reset(defaults)
    }
  }, [entry, schema, isEdit, reset])

  async function onSubmit(values: Record<string, unknown>) {
    const data: EntryData = {}
    for (const f of schema.fields) {
      const v = values[f.id]
      // Skip undefined and empty-string values for optional fields (no data to save)
      if (v !== undefined && !(v === '' && !f.required)) {
        data[f.id] = v
      }
    }
    await onSave(data)
  }

  const label = submitLabel ?? (isEdit ? 'Save changes' : 'Create entry')

  return (
    <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])}>
      {isSchemaStale && (
        <div className="schema-stale-banner">
          <p>This schema changed while you were editing. Reload the form before saving.</p>
          <button type="button" onClick={onReloadSchema}>
            Reload form
          </button>
        </div>
      )}
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

      {error && <p className="mb-3 text-sm text-red-700">Error: {error}</p>}

      <div css={formActionsStyles}>
        <button
          type="submit"
          disabled={isPending || isSchemaStale}
          className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Saving…' : label}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
