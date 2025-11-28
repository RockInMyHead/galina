/**
 * Frontend Integration Tests
 * Tests React components and hooks with API integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useChatAPI } from '@/hooks/useChatAPI'
import { syncService } from '@/utils/syncService'

// Mock fetch
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}

// Mock API responses
const mockApiResponses = {
  balance: { balance: 1500, currency: 'RUB' },
  userProfile: {
    user: {
      id: 'test-user-id',
      email: 'demo@galina.ai',
      name: 'Demo User',
      messages: [],
      balance: { amount: 1500 }
    }
  },
  chatHistory: {
    messages: [
      {
        id: 'msg-1',
        content: 'Hello from API',
        role: 'assistant',
        timestamp: new Date().toISOString()
      }
    ]
  }
}

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
  })

  describe('useBalance Hook', () => {
    it('should fetch balance from API on mount', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.balance)
        })

      global.fetch = mockFetch

      const TestComponent = () => {
        const { balance, isLoading } = useBalance()
        return (
          <div>
            {isLoading ? 'Loading...' : `Balance: ${balance}`}
          </div>
        )
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3003/user/balance')
      })

      await waitFor(() => {
        expect(screen.getByText('Balance: 1500')).toBeInTheDocument()
      })
    })

    it('should fallback to localStorage when API fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch
      localStorageMock.getItem.mockReturnValue('1000')

      const TestComponent = () => {
        const { balance } = useBalance()
        return <div>Balance: {balance}</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Balance: 1000')).toBeInTheDocument()
      })
    })

    it('should update balance via API', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.balance)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ balance: 1600, currency: 'RUB', operation: 'add' })
        })

      global.fetch = mockFetch

      const TestComponent = () => {
        const { balance, addToBalance, isLoading } = useBalance()
        return (
          <div>
            <div>Balance: {balance}</div>
            <button onClick={() => addToBalance(100)} disabled={isLoading}>
              Add 100
            </button>
          </div>
        )
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Balance: 1500')).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: 'Add 100' })
      await userEvent.click(button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3003/user/balance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 100, operation: 'add' })
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Balance: 1600')).toBeInTheDocument()
      })
    })
  })

  describe('useChatAPI Hook', () => {
    it('should fetch messages from API', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.chatHistory)
        })

      global.fetch = mockFetch

      const TestComponent = () => {
        const { messages, fetchMessages } = useChatAPI()

        return (
          <div>
            <div>Messages: {messages.length}</div>
            <button onClick={fetchMessages}>Fetch</button>
          </div>
        )
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      expect(screen.getByText('Messages: 0')).toBeInTheDocument()

      const button = screen.getByRole('button', { name: 'Fetch' })
      await userEvent.click(button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3003/chat/history')
      })

      await waitFor(() => {
        expect(screen.getByText('Messages: 1')).toBeInTheDocument()
      })
    })

    it('should send message via API', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            message: {
              id: 'new-msg-id',
              content: 'Test message',
              role: 'user',
              timestamp: new Date().toISOString()
            }
          })
        })

      global.fetch = mockFetch

      const TestComponent = () => {
        const { messages, sendMessage } = useChatAPI()

        return (
          <div>
            <div>Messages: {messages.length}</div>
            <button onClick={() => sendMessage('Test message', 'user')}>Send</button>
          </div>
        )
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      const button = screen.getByRole('button', { name: 'Send' })
      await userEvent.click(button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3003/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Test message',
            role: 'user',
            files: []
          })
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Messages: 1')).toBeInTheDocument()
      })
    })
  })

  describe('SyncService', () => {
    it('should perform full sync', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.balance)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.userProfile)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.chatHistory)
        })

      global.fetch = mockFetch

      const result = await syncService.performFullSync()

      expect(result.success).toBe(true)
      expect(result.syncedItems).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      const result = await syncService.performFullSync()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(3) // balance, profile, chat
    })
  })

  describe('AuthContext', () => {
    it('should load user profile from API on initialization', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.userProfile)
        })

      global.fetch = mockFetch

      const TestComponent = () => {
        const { user, isAuthenticated } = useAuth()
        return (
          <div>
            {isAuthenticated ? `User: ${user?.email}` : 'Not authenticated'}
          </div>
        )
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3003/user/profile')
      })

      await waitFor(() => {
        expect(screen.getByText('User: demo@galina.ai')).toBeInTheDocument()
      })
    })
  })
})
