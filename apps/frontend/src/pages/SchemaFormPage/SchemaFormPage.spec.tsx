import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SchemaFormPage from './SchemaFormPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() }))
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({}))
}))

describe('SchemaFormPage', () => {
  it('renders create form heading when no id param', () => {
    render(<SchemaFormPage />)
    expect(screen.getByText('New Schema')).toBeInTheDocument()
  })
})
