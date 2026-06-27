import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldEditor } from './FieldEditor'

const mockRegister = vi.fn(() => ({}))
const mockWatch = vi.fn(() => 'text')
// biome-ignore lint/suspicious/noExplicitAny: test stub — FieldEditor accepts polymorphic Control<any>
const mockControl = {} as any

describe('FieldEditor', () => {
  it('renders field name and type inputs', () => {
    render(
      <FieldEditor
        index={0}
        control={mockControl}
        register={mockRegister}
        watch={mockWatch}
        onRemove={vi.fn()}
        schemas={[]}
      />
    )
    expect(screen.getByLabelText(/field name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
  })

  it('shows reference schema select when type is reference', () => {
    mockWatch.mockReturnValue('reference')
    render(
      <FieldEditor
        index={0}
        control={mockControl}
        register={mockRegister}
        watch={mockWatch}
        onRemove={vi.fn()}
        schemas={[]}
      />
    )
    expect(screen.getByLabelText(/references/i)).toBeInTheDocument()
  })
})
