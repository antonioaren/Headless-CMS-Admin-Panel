import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SchemaListPage from './SchemaListPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() }))
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn())
}))

describe('SchemaListPage', () => {
  it('renders empty state when no schemas exist', () => {
    render(<SchemaListPage />)
    expect(screen.getByText(/no schemas yet/i)).toBeInTheDocument()
  })
})
