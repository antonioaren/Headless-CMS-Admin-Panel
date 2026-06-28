import { FieldEditor } from '@/components/FieldEditor/FieldEditor'
import { MigrationPreviewModal } from '@/features/migration/MigrationPreviewModal'
import { useApplyMutation, usePlanMutation } from '@/features/migration/useMigrationPlan'
import { apiGet, apiPost } from '@/lib/api'
import type { MigrationPlan, Schema } from '@cms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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

  // Migration modal state
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null)
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

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

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: { displayName: '', fields: [defaultField(0)] }
  })

  const { fields, append, remove, swap } = useFieldArray({ control, name: 'fields' })

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

  const planMutation = usePlanMutation(id ?? '')
  const applyMutation = useApplyMutation(id ?? '')

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

  function buildMigrationBody(values: FormValues) {
    return {
      displayName: values.displayName,
      fields: values.fields.map((f, i) => ({ ...f, position: i }))
    }
  }

  function onSubmit(values: FormValues) {
    const missingRef = values.fields.find((f) => f.type === 'reference' && !f.referenceSchemaId)
    if (missingRef) {
      setValidationError(`Field "${missingRef.key || 'unnamed'}" is type reference but no target schema is selected.`)
      return
    }
    setValidationError(null)

    if (isEdit) {
      // In edit mode: call plan first, then show modal
      const body = buildMigrationBody(values)
      setPendingValues(values)
      planMutation.mutate(body, {
        onSuccess: (plan) => {
          setMigrationPlan(plan)
          setShowModal(true)
        }
      })
    } else {
      createMutation.mutate(values)
    }
  }

  function handleModalConfirm() {
    if (!pendingValues || !id) return
    const body = buildMigrationBody(pendingValues)
    applyMutation.mutate(body, {
      onSuccess: (result) => {
        setShowModal(false)
        queryClient.invalidateQueries({ queryKey: ['schemas'] })

        const plan = result.plan
        if (plan.summary.manual > 0) {
          navigate(`/schemas/${id}/repair`, { state: { plan } })
        } else {
          navigate('/schemas')
        }
      }
    })
  }

  function handleModalCancel() {
    setShowModal(false)
    setMigrationPlan(null)
    setPendingValues(null)
  }

  const isPending = createMutation.isPending || planMutation.isPending || applyMutation.isPending
  const error = createMutation.error?.message ?? planMutation.error?.message ?? applyMutation.error?.message

  return (
    <main css={pageShellStyles}>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-950">{isEdit ? 'Edit Schema' : 'New Schema'}</h1>

      <form
        onSubmit={(e) => {
          setSubmitted(true)
          handleSubmit(onSubmit)(e)
        }}
      >
        <div className="mb-5">
          <label htmlFor="displayName" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Schema name
          </label>
          <input
            id="displayName"
            {...register('displayName', { required: true })}
            placeholder="e.g. Person"
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:ring-2 ${submitted && errors.displayName ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
          />
          {submitted && errors.displayName && <p className="mt-1 text-xs text-red-600">Schema name is required.</p>}
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
                    showReferenceError={submitted}
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

        {validationError && <p className="mb-3 text-sm text-red-700">{validationError}</p>}
        {error && <p className="mb-3 text-sm text-red-700">Error: {error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (isEdit ? 'Computing plan…' : 'Saving…') : isEdit ? 'Preview changes' : 'Create schema'}
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

      {showModal && migrationPlan && pendingValues && (
        <MigrationPreviewModal
          plan={migrationPlan}
          proposedFields={pendingValues.fields}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isPending={applyMutation.isPending}
        />
      )}
    </main>
  )
}
