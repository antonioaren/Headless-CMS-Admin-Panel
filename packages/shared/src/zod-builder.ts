import { type ZodTypeAny, z } from 'zod'
import type { Field } from './types'

// Builds a Zod object schema at runtime from field definitions, keyed by field.id.
// The full per-type logic lands in M2 (dynamic entry editor). M0 ships the contract
// so both apps can import a stable signature.
export function buildZodSchema(fields: Field[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}

  for (const field of fields) {
    if (field.required) {
      switch (field.type) {
        case 'text':
        case 'reference':
          shape[field.id] = z.string().min(1)
          break
        case 'number':
          shape[field.id] = z.number()
          break
        case 'boolean':
          shape[field.id] = z.boolean()
          break
        case 'date':
          shape[field.id] = z.string().min(1)
          break
        default:
          shape[field.id] = z.unknown()
      }
    } else {
      switch (field.type) {
        case 'text':
        case 'reference':
        case 'date':
          // Empty string from an unset input coerces to undefined (field is optional)
          shape[field.id] = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable())
          break
        case 'number':
          // Empty number input yields NaN via valueAsNumber; treat as absent
          shape[field.id] = z.preprocess(
            (v) => (v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
            z.number().optional().nullable()
          )
          break
        case 'boolean':
          shape[field.id] = z.boolean().optional().nullable()
          break
        default:
          shape[field.id] = z.unknown().optional()
      }
    }
  }

  return z.object(shape)
}
