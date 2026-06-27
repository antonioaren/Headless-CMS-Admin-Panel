import { FieldEditor } from '@/components/FieldEditor/FieldEditor'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import type { Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fieldReorderControlsStyles,
  fieldRowMainStyles,
  fieldRowStyles,
  fieldStackStyles,
  pageShellStyles,
  sectionHeaderStyles
} from './SchemaFormPage.style'

interface FieldFormValue {
  id?: string
  key: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'reference'
  required: boolean
  referenceSchemaId: string | null
  position: number
}

interface FormValues {
  displayName: string
  fields: FieldFormValue[]
}

function defaultField(position: number): FieldFormValue {
  return { key: '', type: 'text', required: false, referenceSchemaId: null, position }
}

export default function SchemaFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: schema } = useQuery({
    queryKey: ['schema', id],
    queryFn: () =>
      apiGet<{ data: Schema }>('/api/schemas').then((r) => {
        const list = r.data as unknown as Schema[]
        return list.find((s) => s.id === id) ?? null
      }),
    enabled: isEdit
  })

  const { data: allSchemas = [] } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => apiGet<{ data: Schema[] }>('/api/schemas').then((r) => r.data)
  })

  const { register, control, watch, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { displayName: '', fields: [defaultField(0)] }
  })

  const { fields, append, remove, swap } = useFieldArray({ control, name: 'fields' })

  // Populate form when editing
  useEffect(() => {
    if (schema) {
      reset({
        displayName: schema.displayName,
        fields: schema.fields.map((f) => ({
          id: f.id,
          key: f.key,
          type: f.type,
          required: f.required,
          referenceSchemaId: f.referenceSchemaId,
          position: f.position
        }))
      })
    }
  }, [schema, reset])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiPost<Schema>('/api/schemas', {
        displayName: values.displayName,
        fields: values.fields.map((f, i) => ({ ...f, position: i }))
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
      navigate('/schemas')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiPatch<Schema>(`/api/schemas/${id}`, {
        displayName: values.displayName,
        fields: values.fields.map((f, i) => ({ ...f, position: i }))
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
      navigate('/schemas')
    }
  })

  function onSubmit(values: FormValues) {
    if (isEdit) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error?.message ?? updateMutation.error?.message

  return (
    <main css={pageShellStyles}>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-950">{isEdit ? 'Edit Schema' : 'New Schema'}</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-5">
          <label htmlFor="displayName" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Schema name
          </label>
          <input
            id="displayName"
            {...register('displayName', { required: true })}
            placeholder="e.g. Person"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="mb-5">
          <div css={sectionHeaderStyles}>
            <strong>Fields</strong>
            <button
              type="button"
              onClick={() => append(defaultField(fields.length))}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
            >
              + Add Field
            </button>
          </div>

          {fields.length === 0 && <p className="text-sm text-slate-500">No fields yet. Add one above.</p>}

          <div css={fieldStackStyles}>
            {fields.map((field, index) => (
              <div key={field.id} css={fieldRowStyles}>
                <div css={fieldRowMainStyles}>
                  <FieldEditor
                    index={index}
                    control={control}
                    register={register}
                    watch={watch}
                    onRemove={() => remove(index)}
                    schemas={allSchemas}
                  />
                </div>
                <div css={fieldReorderControlsStyles}>
                  <button
                    type="button"
                    onClick={() => index > 0 && swap(index, index - 1)}
                    disabled={index === 0}
                    title="Move up"
                    className="rounded border border-slate-300 bg-transparent px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => index < fields.length - 1 && swap(index, index + 1)}
                    disabled={index === fields.length - 1}
                    title="Move down"
                    className="rounded border border-slate-300 bg-transparent px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-700">Error: {error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create schema'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/schemas')}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  )
}
