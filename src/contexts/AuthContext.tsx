import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, AuthContextType } from '@/types'
import { API_CONFIG } from '@/config/constants'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Проверяем, есть ли сохраненная сессия при загрузке
    const initializeAuth = async () => {
      let tokenFromStorage: string | null = null
      let savedUser: string | null = null

      try {
        tokenFromStorage = localStorage.getItem('galina-token')
        savedUser = localStorage.getItem('galina-user')
      } catch (storageError) {
        console.warn('Failed to access localStorage:', storageError)
        setIsLoading(false)
        return
      }

      try {
        if (tokenFromStorage && savedUser) {
          // Проверяем токен через API
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

            const response = await fetch(`${API_CONFIG.BASE_URL}/user/profile`, {
              headers: {
                'Authorization': `Bearer ${tokenFromStorage}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (response.ok) {
              const data = await response.json()
              if (data && data.user) {
                const apiUser: User = {
                  id: data.user.id,
                  email: data.user.email,
                  name: data.user.name
                }
                setUser(apiUser)
                setToken(tokenFromStorage)
                setIsLoading(false)
                return
              }
            }

            // Если ответ не OK (401, 403, 500 и т.д.), очищаем сессию
            console.warn('Token validation failed, status:', response.status)
            try {
              localStorage.removeItem('galina-token')
              localStorage.removeItem('galina-user')
            } catch (e) {
              console.warn('Failed to clear localStorage:', e)
            }
          } catch (apiError) {
            // Handle abort error separately
            if (apiError instanceof Error && apiError.name === 'AbortError') {
              console.warn('Token validation request timed out')
            } else {
              console.warn('Token validation failed, clearing session:', apiError)
            }
            try {
              localStorage.removeItem('galina-token')
              localStorage.removeItem('galina-user')
            } catch (e) {
              console.warn('Failed to clear localStorage:', e)
            }
          }
        }

        // Если токен недействителен или отсутствует, пробуем localStorage как fallback
        if (savedUser && !tokenFromStorage) {
          try {
            const parsedUser = JSON.parse(savedUser) as User
            // Валидация сохраненных данных
            if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.name) {
              setUser(parsedUser)
              setToken(null)
            } else {
              // Очистка поврежденных данных
              localStorage.removeItem('galina-user')
            }
          } catch (parseError) {
            console.warn('Failed to parse saved user:', parseError)
            localStorage.removeItem('galina-user')
          }
        }
      } catch (error) {
        console.warn('Failed to load saved user session:', error)
        try {
          localStorage.removeItem('galina-user')
          localStorage.removeItem('galina-token')
        } catch (e) {
          console.warn('Failed to clear localStorage:', e)
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)

      // Реальный API вызов для входа
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        const apiUser: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name
        }

        setUser(apiUser)
        setToken(data.token)
        // Сохраняем токен и пользователя
        localStorage.setItem('galina-user', JSON.stringify(apiUser))
        localStorage.setItem('galina-token', data.token)
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Login failed:', errorData.error)
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      setIsLoading(true)

      // Реальный API вызов для регистрации
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      })

      if (response.ok) {
        const data = await response.json()
        const apiUser: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name
        }

        setUser(apiUser)
        setToken(data.token)
        // Сохраняем токен и пользователя
        localStorage.setItem('galina-user', JSON.stringify(apiUser))
        localStorage.setItem('galina-token', data.token)
        return true
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Registration failed:', response.status, errorData)
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = (): void => {
    try {
      setUser(null)
      setToken(null)
      localStorage.removeItem('galina-user')
      localStorage.removeItem('galina-token')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
