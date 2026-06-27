import type { MigrationImpact, MigrationPlan } from '@cms/shared'

interface ProposedFieldRef {
  id?: string
  key: string
}

interface MigrationPreviewModalProps {
  plan: MigrationPlan
  proposedFields: ProposedFieldRef[]
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

const STATUS_BADGE: Record<string, string> = {
  ok: 'rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800',
  auto: 'rounded px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800',
  manual: 'rounded px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800'
}

function fieldLabel(fieldId: string, proposedFields: ProposedFieldRef[]): string {
  const found = proposedFields.find((f) => f.id === fieldId)
  return found?.key ?? fieldId
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function ImpactRow({ impact, proposedFields }: { impact: MigrationImpact; proposedFields: ProposedFieldRef[] }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="py-2 pr-4 text-sm text-slate-800">{fieldLabel(impact.fieldId, proposedFields)}</td>
      <td className="py-2 pr-4 text-sm text-slate-500">{formatValue(impact.oldValue)}</td>
      <td className="py-2 pr-4 text-sm text-slate-500">
        {impact.proposedValue !== undefined ? formatValue(impact.proposedValue) : '—'}
      </td>
      <td className="py-2 pr-4">
        <span className={STATUS_BADGE[impact.status] ?? STATUS_BADGE.manual}>{impact.status}</span>
      </td>
      <td className="py-2 text-xs text-slate-400">{impact.reason ?? ''}</td>
    </tr>
  )
}

export function MigrationPreviewModal({
  plan,
  proposedFields,
  onConfirm,
  onCancel,
  isPending
}: MigrationPreviewModalProps) {
  const { summary, impact } = plan

  const sorted = [...impact].sort((a, b) => {
    const order: Record<string, number> = { manual: 0, auto: 1, ok: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-950">Schema Migration Preview</h2>
          <p className="mt-1 text-sm text-slate-500">Review the impact on existing entries before applying changes.</p>
        </div>

        <div className="flex gap-6 border-b border-slate-200 bg-slate-50 px-6 py-3">
          <span className="text-sm font-semibold text-emerald-700">ok: {summary.ok}</span>
          <span className="text-sm font-semibold text-blue-700">auto: {summary.auto}</span>
          <span className="text-sm font-semibold text-amber-700">manual: {summary.manual}</span>
        </div>

        {summary.destructive && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3">
            <p className="text-sm font-semibold text-red-700">
              Warning: This migration deletes one or more fields. Affected entry data will be permanently removed.
            </p>
          </div>
        )}

        {summary.manual > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">
                {summary.manual} manual review{summary.manual > 1 ? 's' : ''} required.
              </span>{' '}
              After applying, a repair page will open so you can fix affected entries.
            </p>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto px-6 py-4">
          {impact.length === 0 ? (
            <p className="text-sm text-slate-500">No existing entries are affected by this change.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Field</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Current value</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Proposed value</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Status</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Note</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, idx) => (
                  <ImpactRow
                    key={`${item.entryId}-${item.fieldId}-${idx}`}
                    impact={item}
                    proposedFields={proposedFields}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Applying…' : 'Apply changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
