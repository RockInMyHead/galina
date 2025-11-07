import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import Login from '@/pages/Login'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Wrapper component for tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
)

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Login Component', () => {
    it('renders login form correctly', () => {
      render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      )

      expect(screen.getByText('Вход в личный кабинет')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /войти$/i })).toBeInTheDocument()
    })

        it('shows validation errors for empty form submission', async () => {
          render(
            <TestWrapper>
              <Login />
            </TestWrapper>
          )

          const submitButton = screen.getByRole('button', { name: /войти$/i })
          fireEvent.click(submitButton)

          await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByRole('alert')).toHaveTextContent('Email обязателен. Пароль обязателен')
          })
        })

        it('shows validation errors for invalid email', async () => {
          render(
            <TestWrapper>
              <Login />
            </TestWrapper>
          )

          const emailInput = screen.getByLabelText(/email/i)
          const passwordInput = screen.getByPlaceholderText('••••••••')
          const submitButton = screen.getByRole('button', { name: /войти$/i })

          fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
          fireEvent.change(passwordInput, { target: { value: 'password123' } })
          fireEvent.click(submitButton)

          await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByRole('alert')).toHaveTextContent('Введите корректный email')
          })
        })

        it('shows validation errors for short password', async () => {
          render(
            <TestWrapper>
              <Login />
            </TestWrapper>
          )

          const emailInput = screen.getByLabelText(/email/i)
          const passwordInput = screen.getByPlaceholderText('••••••••')
          const submitButton = screen.getByRole('button', { name: /войти$/i })

          fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
          fireEvent.change(passwordInput, { target: { value: '123' } })
          fireEvent.click(submitButton)

          await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByRole('alert')).toHaveTextContent('Пароль должен содержать минимум 6 символов')
          })
        })



    it('toggles password visibility', () => {
      render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      )

      const passwordInput = screen.getByPlaceholderText('••••••••')
      const toggleButton = passwordInput.parentElement?.querySelector('button')

      expect(passwordInput).toHaveAttribute('type', 'password')

      if (toggleButton) {
        fireEvent.click(toggleButton)
        expect(passwordInput).toHaveAttribute('type', 'text')

        fireEvent.click(toggleButton)
        expect(passwordInput).toHaveAttribute('type', 'password')
      }
    })


  })
})
