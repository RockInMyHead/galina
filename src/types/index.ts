// Re-export all types for convenience
export * from './chat'
export * from './components'
export * from './api'

// Legacy types (keeping for backward compatibility)
export interface User {
  id: string
  email: string
  name: string
}

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
}

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export type FormErrors<T extends Record<string, any> = any> = {
  [K in keyof T]?: string
} & {
  general?: string
}

// Legacy constants (moved to config/constants.ts)
export const MIN_PASSWORD_LENGTH = 6
export const MIN_NAME_LENGTH = 2
