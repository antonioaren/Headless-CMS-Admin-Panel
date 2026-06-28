import { describe, expect, it } from 'vitest'
import { buildPlan, classifyCell, diff } from './migration'
import type { Schema } from './types'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeSchema(fields: Schema['fields']): Schema {
  return {
    id: 's1',
    slug: 'car',
    displayName: 'Car',
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    fields
  }
}

function field(overrides: Partial<Schema['fields'][number]>): Schema['fields'][number] {
  return {
    id: 'f1',
    schemaId: 's1',
    key: 'year',
    type: 'text',
    required: false,
    referenceSchemaId: null,
    position: 0,
    config: {},
    ...overrides
  }
}

// ─── diff ───────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('returns empty when nothing changed', () => {
    const schema = makeSchema([field({ id: 'f1', key: 'year', type: 'text' })])
    const result = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'year', type: 'text', required: false, referenceSchemaId: null, position: 0 }]
    })
    expect(result).toHaveLength(0)
  })

  it('detects rename', () => {
    const schema = makeSchema([field({ id: 'f1', key: 'year' })])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'modelo', type: 'text', required: false, referenceSchemaId: null, position: 0 }]
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'rename', fieldId: 'f1', from: 'year', to: 'modelo' })
  })

  it('detects retype', () => {
    const schema = makeSchema([field({ id: 'f1', type: 'text' })])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'year', type: 'number', required: false, referenceSchemaId: null, position: 0 }]
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'retype', from: 'text', to: 'number' })
  })

  it('detects delete when field absent from proposed', () => {
    const schema = makeSchema([field({ id: 'f1', key: 'year' })])
    const changes = diff(schema, { id: 's1', fields: [] })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'delete', fieldId: 'f1' })
  })

  it('detects require upgrade (false → true)', () => {
    const schema = makeSchema([field({ id: 'f1', required: false })])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'year', type: 'text', required: true, referenceSchemaId: null, position: 0 }]
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'require', from: false, to: true })
  })

  it('ignores require downgrade (true → false)', () => {
    const schema = makeSchema([field({ id: 'f1', required: true })])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'year', type: 'text', required: false, referenceSchemaId: null, position: 0 }]
    })
    expect(changes).toHaveLength(0)
  })

  it('detects retarget', () => {
    const schema = makeSchema([field({ id: 'f1', type: 'reference', referenceSchemaId: 'sa' })])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ id: 'f1', key: 'year', type: 'reference', required: false, referenceSchemaId: 'sb', position: 0 }]
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'retarget', from: 'sa', to: 'sb' })
  })

  it('skips fields without id (new fields)', () => {
    const schema = makeSchema([])
    const changes = diff(schema, {
      id: 's1',
      fields: [{ key: 'brand', type: 'text', required: false, referenceSchemaId: null, position: 0 }]
    })
    expect(changes).toHaveLength(0)
  })
})

// ─── classifyCell ────────────────────────────────────────────────────────────

describe('classifyCell', () => {
  describe('rename', () => {
    it('is always ok (data keyed by field.id, label change only)', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'rename', from: 'year', to: 'modelo' }, 'Tesla')
      expect(r.status).toBe('ok')
    })
  })

  describe('delete', () => {
    it('is always auto', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'delete', from: 'year', to: null }, 'Tesla')
      expect(r.status).toBe('auto')
    })
  })

  describe('require', () => {
    it('ok when value present', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'require', from: false, to: true }, 'something')
      expect(r.status).toBe('ok')
    })

    it('manual when value is null', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'require', from: false, to: true }, null)
      expect(r.status).toBe('manual')
    })

    it('manual when value is empty string', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'require', from: false, to: true }, '')
      expect(r.status).toBe('manual')
    })
  })

  describe('retarget', () => {
    it('manual when reference has a value', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'retarget', from: 'sa', to: 'sb' }, 'some-uuid')
      expect(r.status).toBe('manual')
    })

    it('ok when reference is empty', () => {
      const r = classifyCell({ fieldId: 'f1', kind: 'retarget', from: 'sa', to: 'sb' }, null)
      expect(r.status).toBe('ok')
    })
  })

  describe('retype → number', () => {
    const change = { fieldId: 'f1', kind: 'retype' as const, from: 'text', to: 'number' }

    it('auto-converts numeric string "2024"', () => {
      const r = classifyCell(change, '2024')
      expect(r.status).toBe('auto')
      expect(r.proposedValue).toBe(2024)
    })

    it('manual for non-numeric string "vintage"', () => {
      const r = classifyCell(change, 'vintage')
      expect(r.status).toBe('manual')
    })

    it('manual for "n/a"', () => {
      const r = classifyCell(change, 'n/a')
      expect(r.status).toBe('manual')
    })

    it('ok when value is null/undefined/empty', () => {
      expect(classifyCell(change, null).status).toBe('ok')
      expect(classifyCell(change, undefined).status).toBe('ok')
      expect(classifyCell(change, '').status).toBe('ok')
    })
  })

  describe('retype → text', () => {
    const change = { fieldId: 'f1', kind: 'retype' as const, from: 'number', to: 'text' }

    it('auto-converts number to string', () => {
      const r = classifyCell(change, 42)
      expect(r.status).toBe('auto')
      expect(r.proposedValue).toBe('42')
    })

    it('ok when value is null', () => {
      expect(classifyCell(change, null).status).toBe('ok')
    })
  })

  describe('retype → boolean', () => {
    const change = { fieldId: 'f1', kind: 'retype' as const, from: 'text', to: 'boolean' }

    it('auto true for "true"', () => {
      const r = classifyCell(change, 'true')
      expect(r.status).toBe('auto')
      expect(r.proposedValue).toBe(true)
    })

    it('auto false for "false"', () => {
      const r = classifyCell(change, 'false')
      expect(r.status).toBe('auto')
      expect(r.proposedValue).toBe(false)
    })

    it('auto for numeric 1/0', () => {
      expect(classifyCell(change, 1).proposedValue).toBe(true)
      expect(classifyCell(change, 0).proposedValue).toBe(false)
    })

    it('manual for arbitrary string', () => {
      expect(classifyCell(change, 'vintage').status).toBe('manual')
    })
  })

  describe('retype → date', () => {
    const change = { fieldId: 'f1', kind: 'retype' as const, from: 'text', to: 'date' }

    it('auto-converts valid ISO string', () => {
      const r = classifyCell(change, '2024-03-15')
      expect(r.status).toBe('auto')
      expect(typeof r.proposedValue).toBe('string')
    })

    it('manual for unparseable string', () => {
      expect(classifyCell(change, 'not-a-date').status).toBe('manual')
    })

    it('ok for empty value', () => {
      expect(classifyCell(change, '').status).toBe('ok')
      expect(classifyCell(change, null).status).toBe('ok')
    })
  })
})

// ─── buildPlan ───────────────────────────────────────────────────────────────

describe('buildPlan', () => {
  it('builds summary counts correctly', () => {
    const changes = [{ fieldId: 'f1', kind: 'retype' as const, from: 'text', to: 'number' }]
    const entries = [
      { id: 'e1', data: { f1: '2024' } }, // auto
      { id: 'e2', data: { f1: 'vintage' } }, // manual
      { id: 'e3', data: { f1: '' } } // ok (empty → ok)
    ]
    const plan = buildPlan('s1', changes, entries)

    expect(plan.schemaId).toBe('s1')
    expect(plan.summary.auto).toBe(1)
    expect(plan.summary.manual).toBe(1)
    expect(plan.summary.ok).toBe(1)
    expect(plan.summary.destructive).toBe(false)
  })

  it('marks destructive true when any change is delete', () => {
    const changes = [{ fieldId: 'f1', kind: 'delete' as const, from: 'year', to: null }]
    const plan = buildPlan('s1', changes, [{ id: 'e1', data: { f1: '2024' } }])
    expect(plan.summary.destructive).toBe(true)
  })

  it('produces one impact row per entry × change', () => {
    const changes = [
      { fieldId: 'f1', kind: 'rename' as const, from: 'a', to: 'b' },
      { fieldId: 'f2', kind: 'delete' as const, from: 'c', to: null }
    ]
    const entries = [
      { id: 'e1', data: { f1: 'x', f2: 'y' } },
      { id: 'e2', data: { f1: 'z', f2: 'w' } }
    ]
    const plan = buildPlan('s1', changes, entries)
    expect(plan.impact).toHaveLength(4) // 2 entries × 2 changes
  })

  it('returns empty impact and zero summary for no entries', () => {
    const changes = [{ fieldId: 'f1', kind: 'rename' as const, from: 'a', to: 'b' }]
    const plan = buildPlan('s1', changes, [])
    expect(plan.impact).toHaveLength(0)
    expect(plan.summary).toEqual({ ok: 0, auto: 0, manual: 0, destructive: false })
  })
})
