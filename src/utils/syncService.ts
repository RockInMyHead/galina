import { ChatMessage as ChatMessageType } from '@/types/chat'
import { API_CONFIG } from '@/config/constants'
import { chatStorage, balanceStorage, userStorage } from './storageUtils'

interface SyncResult {
  success: boolean
  syncedItems: number
  errors: string[]
}

/**
 * Service for synchronizing data between localStorage and database
 */
interface OfflineOperation {
  id: string
  type: 'balance_update' | 'chat_message' | 'user_profile_update'
  data: any
  timestamp: number
  retries: number
}

/**
 * Helper function to get the auth token from localStorage
 */
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('galina-token')
  } catch {
    return null
  }
}

/**
 * Helper function to clear auth data from localStorage
 */
const clearAuthData = () => {
  try {
    localStorage.removeItem('galina-token')
    localStorage.removeItem('galina-user')
  } catch (e) {
    console.error('Failed to clear auth data:', e)
  }
}

class SyncService {
  private syncInterval: number = 30000 // 30 seconds
  private intervalId: NodeJS.Timeout | null = null
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private offlineQueue: OfflineOperation[] = []
  private maxRetries: number = 3

  constructor() {
    this.setupNetworkListeners()
    this.loadOfflineQueue()
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners() {
    // Only setup listeners in browser environment
    if (typeof window === 'undefined') {
      return
    }

    window.addEventListener('online', () => {
      this.isOnline = true
      this.startPeriodicSync()
      this.processOfflineQueue()
      console.log('🔄 Network online - starting sync and processing offline queue')
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.stopPeriodicSync()
      console.log('🔄 Network offline - stopping sync')
    })
  }

  /**
   * Start periodic synchronization
   */
  startPeriodicSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    this.intervalId = setInterval(() => {
      if (this.isOnline) {
        this.performFullSync()
      }
    }, this.syncInterval)
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Perform full synchronization of all data
   */
  async performFullSync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      errors: []
    }

    // Check if user is authenticated before syncing
    const token = getAuthToken()
    const userData = userStorage.get()
    if (!userData || !token) {
      // Не логируем это как ошибку - это нормальное поведение для неавторизованных пользователей
      // Логируем только в режиме разработки для отладки
      if (import.meta.env.DEV) {
        console.debug('🔄 Skipping sync - user not authenticated')
      }
      result.success = false
      result.errors.push('User not authenticated')
      return result
    }

    try {
      console.log('🔄 Starting full data synchronization...')

      // Sync chat messages
      const chatResult = await this.syncChatMessages()
      result.syncedItems += chatResult.syncedItems
      result.errors.push(...chatResult.errors)

      // Sync balance
      const balanceResult = await this.syncBalance()
      result.syncedItems += balanceResult.syncedItems
      result.errors.push(...balanceResult.errors)

      // Sync user profile
      const userResult = await this.syncUserProfile()
      result.syncedItems += userResult.syncedItems
      result.errors.push(...userResult.errors)

      if (result.errors.length > 0) {
        result.success = false
        // Логируем только если есть реальные ошибки (не просто отсутствие авторизации)
        const realErrors = result.errors.filter(e => e !== 'User not authenticated')
        if (realErrors.length > 0) {
          console.warn(`🔄 Sync completed with errors: ${result.syncedItems} items synced, ${realErrors.length} errors`)
        } else if (import.meta.env.DEV) {
          // В режиме разработки логируем даже отсутствие авторизации
          console.debug(`🔄 Sync skipped: user not authenticated`)
        }
      } else {
        // Логируем успешную синхронизацию только в режиме разработки
        if (import.meta.env.DEV && result.syncedItems > 0) {
          console.log(`🔄 Sync completed: ${result.syncedItems} items synced`)
        }
      }
    } catch (error) {
      result.success = false
      result.errors.push(`Sync failed: ${error}`)
      console.error('🔄 Sync error:', error)
    }

    return result
  }

  /**
   * Sync chat messages
   */
  private async syncChatMessages(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      errors: []
    }

    try {
      const token = getAuthToken()
      if (!token) {
        return result // Skip if no token
      }

      const localMessages = chatStorage.get() || []

      // Get last sync timestamp from localStorage
      const lastSyncKey = 'galina-chat-last-sync'
      const lastSync = localStorage.getItem(lastSyncKey)
      const since = lastSync ? new Date(lastSync) : new Date(0)

      // Fetch new messages from API with Authorization header
      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/history?since=${since.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // User not authenticated or token invalid, clear auth data and skip sync
          console.log('👤 Token invalid, clearing auth data and skipping chat sync')
          clearAuthData()
          return result
        }
        throw new Error(`Failed to fetch chat history: ${response.status}`)
      }

      const data = await response.json()
      const apiMessages: ChatMessageType[] = data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.timestamp)
      }))

      if (apiMessages.length > 0) {
        // Merge with local messages (API takes precedence)
        const mergedMessages = this.mergeMessages(localMessages, apiMessages)
        chatStorage.set(mergedMessages)
        result.syncedItems = apiMessages.length

        // Update last sync timestamp
        localStorage.setItem(lastSyncKey, new Date().toISOString())
      }
    } catch (error) {
      result.success = false
      result.errors.push(`Chat sync error: ${error}`)
    }

    return result
  }

  /**
   * Sync balance
   */
  private async syncBalance(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      errors: []
    }

    try {
      const token = getAuthToken()
      if (!token) {
        return result // Skip if no token
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // User not authenticated or token invalid, clear auth data and skip sync
          console.log('👤 Token invalid, clearing auth data and skipping balance sync')
          clearAuthData()
          return result
        }
        throw new Error(`Failed to fetch balance: ${response.status}`)
      }

      const data = await response.json()
      const apiBalance = data.balance
      const localBalance = balanceStorage.get()

      // If API balance is different, update localStorage
      if (apiBalance !== localBalance) {
        balanceStorage.set(apiBalance)
        result.syncedItems = 1
      }
    } catch (error) {
      result.success = false
      result.errors.push(`Balance sync error: ${error}`)
    }

    return result
  }

  /**
   * Sync user profile
   */
  private async syncUserProfile(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      errors: []
    }

    try {
      const token = getAuthToken()
      if (!token) {
        return result // Skip if no token
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // User not authenticated or token invalid, clear auth data and skip sync
          console.log('👤 Token invalid, clearing auth data and skipping profile sync')
          clearAuthData()
          return result
        }
        throw new Error(`Failed to fetch user profile: ${response.status}`)
      }

      const data = await response.json()
      if (data.user) {
        const apiUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.email.split('@')[0]
        }

        const localUser = userStorage.get()

        // If API user is different, update localStorage
        if (!localUser || JSON.stringify(apiUser) !== JSON.stringify(localUser)) {
          userStorage.set(apiUser)
          result.syncedItems = 1
        }
      }
    } catch (error) {
      result.success = false
      result.errors.push(`User profile sync error: ${error}`)
    }

    return result
  }

  /**
   * Merge messages with conflict resolution (API takes precedence)
   */
  private mergeMessages(localMessages: ChatMessageType[], apiMessages: ChatMessageType[]): ChatMessageType[] {
    const messageMap = new Map<string, ChatMessageType>()

    // Add local messages
    localMessages.forEach(msg => messageMap.set(msg.id, msg))

    // Add/update with API messages (API takes precedence)
    apiMessages.forEach(msg => messageMap.set(msg.id, msg))

    // Sort by timestamp
    return Array.from(messageMap.values()).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  /**
   * Force immediate sync
   */
  async forceSync(): Promise<SyncResult> {
    return this.performFullSync()
  }

  /**
   * Add operation to offline queue
   */
  addToOfflineQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retries'>) {
    const offlineOp: OfflineOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      ...operation
    }

    this.offlineQueue.push(offlineOp)
    this.saveOfflineQueue()
    console.log('📋 Added to offline queue:', operation.type)
  }

  /**
   * Process offline queue when back online
   */
  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return

    console.log('🔄 Processing offline queue:', this.offlineQueue.length, 'operations')

    const remainingOps: OfflineOperation[] = []

    for (const operation of this.offlineQueue) {
      try {
        await this.executeOfflineOperation(operation)
        console.log('✅ Processed offline operation:', operation.type)
      } catch (error) {
        operation.retries++
        if (operation.retries < this.maxRetries) {
          remainingOps.push(operation)
          console.log('⏰ Retry scheduled for operation:', operation.type, `(attempt ${operation.retries})`)
        } else {
          console.error('❌ Max retries exceeded for operation:', operation.type)
        }
      }
    }

    this.offlineQueue = remainingOps
    this.saveOfflineQueue()
  }

  /**
   * Execute a single offline operation
   */
  private async executeOfflineOperation(operation: OfflineOperation): Promise<void> {
    switch (operation.type) {
      case 'balance_update':
        await this.executeBalanceUpdate(operation.data)
        break
      case 'chat_message':
        await this.executeChatMessage(operation.data)
        break
      case 'user_profile_update':
        await this.executeProfileUpdate(operation.data)
        break
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  /**
   * Execute balance update operation
   */
  private async executeBalanceUpdate(data: { amount: number; operation: string }) {
    const token = getAuthToken()
    if (!token) {
      throw new Error('No auth token available')
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/user/balance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuthData()
        throw new Error('Token invalid')
      }
      throw new Error(`Balance update failed: ${response.status}`)
    }
  }

  /**
   * Execute chat message operation
   */
  private async executeChatMessage(data: { content: string; role: string; files: any[] }) {
    const token = getAuthToken()
    if (!token) {
      throw new Error('No auth token available')
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuthData()
        throw new Error('Token invalid')
      }
      throw new Error(`Chat message send failed: ${response.status}`)
    }
  }

  /**
   * Execute profile update operation
   */
  private async executeProfileUpdate(data: any) {
    // Profile updates are less common, implement if needed
    console.log('Profile update operation not implemented yet')
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue() {
    try {
      localStorage.setItem('galina-offline-queue', JSON.stringify(this.offlineQueue))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue() {
    try {
      const stored = localStorage.getItem('galina-offline-queue')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate that parsed data is an array
        if (Array.isArray(parsed)) {
          this.offlineQueue = parsed
        } else {
          console.warn('Invalid offline queue format, resetting')
          this.offlineQueue = []
        }
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error)
      this.offlineQueue = []
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isRunning: this.intervalId !== null,
      syncInterval: this.syncInterval,
      offlineQueueLength: this.offlineQueue.length
    }
  }

  /**
   * Clear offline queue (for testing or manual cleanup)
   */
  clearOfflineQueue() {
    this.offlineQueue = []
    this.saveOfflineQueue()
    console.log('🗑️ Offline queue cleared')
  }
}

// Create singleton instance
export const syncService = new SyncService()
