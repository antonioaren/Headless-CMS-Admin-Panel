import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EntryFormPage from './EntryFormPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: null, isLoading: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() }))
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({ schemaId: 'schema-1' }))
}))

describe('EntryFormPage', () => {
  it('shows not-found message when schema is missing', () => {
    render(<EntryFormPage />)
    expect(screen.getByText(/schema not found/i)).toBeInTheDocument()
  })
})
