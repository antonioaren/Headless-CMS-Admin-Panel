import type { Schema } from '@cms/shared'
import type { Control, UseFormRegister, UseFormWatch } from 'react-hook-form'
import { fieldEditorStyles, requiredCellStyles } from './FieldEditor.style'

interface FieldEditorProps {
  index: number
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic RHF prop — form shape defined by parent
  control: Control<any>
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic RHF prop — form shape defined by parent
  register: UseFormRegister<any>
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic RHF prop — form shape defined by parent
  watch: UseFormWatch<any>
  onRemove: () => void
  schemas: Schema[]
}

const compactControlClassName =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export function FieldEditor({ index, register, watch, onRemove, schemas }: FieldEditorProps) {
  const fieldType = watch(`fields.${index}.type`)

  return (
    <div css={fieldEditorStyles}>
      <div>
        <label htmlFor={`fields.${index}.key`} className="mb-1.5 block text-xs font-semibold text-slate-600">
          Field name
        </label>
        <input
          id={`fields.${index}.key`}
          {...register(`fields.${index}.key`)}
          placeholder="field_name"
          className={compactControlClassName}
        />
      </div>

      <div>
        <label htmlFor={`fields.${index}.type`} className="mb-1.5 block text-xs font-semibold text-slate-600">
          Type
        </label>
        <select id={`fields.${index}.type`} {...register(`fields.${index}.type`)} className={compactControlClassName}>
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="date">date</option>
          <option value="reference">reference</option>
        </select>
      </div>

      <div css={requiredCellStyles}>
        <label htmlFor={`fields.${index}.required`} className="mb-1.5 block text-xs font-semibold text-slate-600">
          Required
        </label>
        <input
          id={`fields.${index}.required`}
          type="checkbox"
          {...register(`fields.${index}.required`)}
          className="h-4 w-4 accent-blue-600"
        />
      </div>

      {fieldType === 'reference' ? (
        <div>
          <label
            htmlFor={`fields.${index}.referenceSchemaId`}
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            References
          </label>
          <select
            id={`fields.${index}.referenceSchemaId`}
            {...register(`fields.${index}.referenceSchemaId`)}
            className={compactControlClassName}
          >
            <option value="">— pick schema —</option>
            {schemas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div />
      )}

      <button
        type="button"
        onClick={onRemove}
        title="Remove field"
        className="rounded border border-slate-300 bg-transparent px-2 py-1 text-red-700 hover:bg-red-50"
      >
        ✕
      </button>
    </div>
  )
}
