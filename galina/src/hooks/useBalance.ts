import { useState, useEffect, useCallback } from 'react'
import { balanceStorage } from '@/utils/storageUtils'
import { API_CONFIG } from '@/config/constants'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook for managing user balance with API sync
 */
export const useBalance = () => {
  const [balance, setBalance] = useState(() => balanceStorage.get())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token } = useAuth()

  // Fetch balance from API
  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!token) {
        // No token - use localStorage fallback
        const localBalance = balanceStorage.get()
        setBalance(localBalance)
        setIsLoading(false)
        return localBalance
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`)
      }

      const data = await response.json()
      const apiBalance = data.balance

      // Update local state and storage
      setBalance(apiBalance)
      balanceStorage.set(apiBalance)

      return apiBalance
    } catch (err) {
      console.error('Error fetching balance from API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Fallback to localStorage if API fails
      const localBalance = balanceStorage.get()
      setBalance(localBalance)
      return localBalance
    } finally {
      setIsLoading(false)
    }
  }, [token])

  // Update balance via API
  const updateBalanceAPI = useCallback(async (newBalance: number) => {
    try {
      setIsLoading(true)
      setError(null)

      if (!token) {
        // No token - use localStorage fallback
        setBalance(newBalance)
        balanceStorage.set(newBalance)
        setIsLoading(false)
        return newBalance
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: newBalance,
          operation: 'set'
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update balance: ${response.status}`)
      }

      const data = await response.json()

      // Update local state and storage
      setBalance(data.balance)
      balanceStorage.set(data.balance)

      return data.balance
    } catch (err) {
      console.error('Error updating balance via API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Fallback to localStorage if API fails
      setBalance(newBalance)
      balanceStorage.set(newBalance)
      return newBalance
    } finally {
      setIsLoading(false)
    }
  }, [token])

  const addToBalance = async (amount: number) => {
    const newBalance = balance + amount

    // Update local state immediately for responsive UI
    setBalance(newBalance)
    balanceStorage.set(newBalance)

    try {
      setIsLoading(true)
      setError(null)

      if (!token) {
        // No token - use localStorage only
        setIsLoading(false)
        return newBalance
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          operation: 'add'
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to add to balance: ${response.status}`)
      }

      const data = await response.json()

      // Update with server response (in case of conflicts)
      setBalance(data.balance)
      balanceStorage.set(data.balance)

      return data.balance
    } catch (err) {
      console.error('Error adding to balance via API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Add to offline queue if offline
      if (!navigator.onLine) {
        import('@/utils/syncService').then(({ syncService }) => {
          syncService.addToOfflineQueue({
            type: 'balance_update',
            data: { amount, operation: 'add' }
          })
          console.log('📋 Balance update queued for offline sync')
        }).catch(err => {
          console.error('Failed to import syncService:', err)
        })
      }

      // Return locally calculated value
      return newBalance
    } finally {
      setIsLoading(false)
    }
  }

  const subtractFromBalance = async (amount: number) => {
    const newBalance = Math.max(0, balance - amount)

    // Update local state immediately for responsive UI
    setBalance(newBalance)
    balanceStorage.set(newBalance)

    try {
      setIsLoading(true)
      setError(null)

      if (!token) {
        // No token - use localStorage only
        setIsLoading(false)
        return newBalance
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          operation: 'subtract'
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to subtract from balance: ${response.status}`)
      }

      const data = await response.json()

      // Update with server response (in case of conflicts)
      setBalance(data.balance)
      balanceStorage.set(data.balance)

      return data.balance
    } catch (err) {
      console.error('Error subtracting from balance via API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Add to offline queue if offline
      if (!navigator.onLine) {
        import('@/utils/syncService').then(({ syncService }) => {
          syncService.addToOfflineQueue({
            type: 'balance_update',
            data: { amount, operation: 'subtract' }
          })
          console.log('📋 Balance update queued for offline sync')
        }).catch(err => {
          console.error('Failed to import syncService:', err)
        })
      }

      // Return locally calculated value
      return newBalance
    } finally {
      setIsLoading(false)
    }
  }

  // Legacy localStorage methods for backward compatibility
  const updateBalance = (newBalance: number) => {
    setBalance(newBalance)
    balanceStorage.set(newBalance)
  }

  const resetBalance = () => {
    const resetAmount = balanceStorage.reset() ? balanceStorage.get() : 0
    updateBalance(resetAmount)
  }

  // Sync with localStorage changes (in case of multi-tab usage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'galina-balance' && e.newValue) {
        setBalance(parseFloat(e.newValue))
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    isLoading,
    error,
    updateBalance,
    updateBalanceAPI,
    addToBalance,
    subtractFromBalance,
    resetBalance,
    refetch: fetchBalance,
  }
}
