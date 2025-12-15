import { BALANCE_CONFIG, STORAGE_KEYS } from '@/config/constants'

/**
 * Generic storage utilities
 */
export const storage = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error)
      return null
    }
  },

  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error)
      return false
    }
  },

  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
      return false
    }
  },

  clear: (): boolean => {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing localStorage:', error)
      return false
    }
  },
}

/**
 * Balance-specific storage utilities
 */
export const balanceStorage = {
  get: (): number => {
    const saved = storage.get<number>(STORAGE_KEYS.BALANCE)
    return saved !== null ? saved : BALANCE_CONFIG.INITIAL_AMOUNT
  },

  set: (amount: number): boolean => {
    return storage.set(STORAGE_KEYS.BALANCE, amount)
  },

  add: (amount: number): number => {
    const current = balanceStorage.get()
    const newAmount = current + amount
    balanceStorage.set(newAmount)
    return newAmount
  },

  subtract: (amount: number): number => {
    const current = balanceStorage.get()
    const newAmount = Math.max(0, current - amount)
    balanceStorage.set(newAmount)
    return newAmount
  },

  reset: (): boolean => {
    return balanceStorage.set(BALANCE_CONFIG.INITIAL_AMOUNT)
  },
}

/**
 * User-specific storage utilities
 */
export const userStorage = {
  get: () => storage.get(STORAGE_KEYS.USER),
  set: (user: any) => storage.set(STORAGE_KEYS.USER, user),
  remove: () => storage.remove(STORAGE_KEYS.USER),
}

/**
 * Template request storage utilities
 */
export const templateStorage = {
  get: () => storage.get(STORAGE_KEYS.TEMPLATE_REQUEST),
  set: (request: string) => storage.set(STORAGE_KEYS.TEMPLATE_REQUEST, request),
  remove: () => storage.remove(STORAGE_KEYS.TEMPLATE_REQUEST),
}

/**
 * Scan request storage utilities
 */
export const scanStorage = {
  get: () => storage.get(STORAGE_KEYS.SCAN_REQUEST),
  set: (request: string) => storage.set(STORAGE_KEYS.SCAN_REQUEST, request),
  remove: () => storage.remove(STORAGE_KEYS.SCAN_REQUEST),
}

/**
 * Chat messages storage utilities
 */
export const chatStorage = {
  get: () => storage.get(STORAGE_KEYS.CHAT_MESSAGES),
  set: (messages: any[]) => storage.set(STORAGE_KEYS.CHAT_MESSAGES, messages),
  remove: () => storage.remove(STORAGE_KEYS.CHAT_MESSAGES),
  clear: () => {
    const messages = [{
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    }];
    chatStorage.set(messages);
    return messages;
  }
}
