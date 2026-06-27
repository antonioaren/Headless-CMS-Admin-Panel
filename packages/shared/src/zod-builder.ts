import { type ZodTypeAny, z } from 'zod'
import type { Field } from './types'

// Builds a Zod object schema at runtime from field definitions, keyed by field.id.
// The full per-type logic lands in M2 (dynamic entry editor). M0 ships the contract
// so both apps can import a stable signature.
export function buildZodSchema(fields: Field[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}

  for (const field of fields) {
    let base: ZodTypeAny = z.unknown()

    switch (field.type) {
      case 'text':
      case 'reference':
        base = z.string()
        break
      case 'number':
        base = z.number()
        break
      case 'boolean':
        base = z.boolean()
        break
      case 'date':
        base = z.string() // ISO string; refined in M2
        break
    }

    shape[field.id] = field.required ? base : base.optional().nullable()
  }

  return z.object(shape)
}
