import { useState, useEffect } from 'react'
import { balanceStorage } from '@/utils/storageUtils'

/**
 * Hook for managing user balance
 */
export const useBalance = () => {
  const [balance, setBalance] = useState(() => balanceStorage.get())

  const updateBalance = (newBalance: number) => {
    setBalance(newBalance)
    balanceStorage.set(newBalance)
  }

  const addToBalance = (amount: number) => {
    const newBalance = balance + amount
    updateBalance(newBalance)
    return newBalance
  }

  const subtractFromBalance = (amount: number) => {
    const newBalance = Math.max(0, balance - amount)
    updateBalance(newBalance)
    return newBalance
  }

  const resetBalance = () => {
    updateBalance(balanceStorage.reset() ? balanceStorage.get() : 0)
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

  return {
    balance,
    updateBalance,
    addToBalance,
    subtractFromBalance,
    resetBalance,
  }
}
