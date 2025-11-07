import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// Mock Navigate component
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, { replace })
      return null
    }
  }
})

// Test component that shows auth status
const TestComponent: React.FC = () => {
  const { isAuthenticated, user } = useAuth()
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      {user && <div data-testid="user-name">{user.name}</div>}
    </div>
  )
}

// Wrapper for tests
const TestWrapper: React.FC<{
  children: React.ReactNode
  initialAuthState?: { isAuthenticated: boolean; user: any }
}> = ({ children, initialAuthState }) => {
  const queryClient = new QueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders children when user is authenticated', async () => {
    // Mock authenticated user in localStorage
    localStorage.setItem('galina-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      name: 'Test User'
    }))

    render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User')
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('redirects to login when user is not authenticated', async () => {
    render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })

  it('shows loading spinner while checking authentication', () => {
    render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    )

    // Should show loading state initially
    expect(screen.getByRole('generic', { hidden: true })).toBeInTheDocument()
  })

  it('handles invalid user data in localStorage gracefully', async () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('galina-user', 'invalid-json')

    render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })

  it('handles incomplete user data in localStorage', async () => {
    // Set incomplete user data
    localStorage.setItem('galina-user', JSON.stringify({
      id: '1',
      email: 'test@example.com'
      // missing name
    }))

    render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})
