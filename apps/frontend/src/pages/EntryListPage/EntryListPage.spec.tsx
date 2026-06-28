import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EntryListPage from './EntryListPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() }))
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({ schemaId: 'schema-1' }))
}))

describe('EntryListPage', () => {
  it('renders empty state when schema has no entries', () => {
    render(<EntryListPage />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })
})
