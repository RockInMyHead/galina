import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, AuthContextType } from '@/types'

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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Проверяем, есть ли сохраненная сессия при загрузке
    const initializeAuth = () => {
      try {
        const savedUser = localStorage.getItem('galina-user')
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser) as User
          // Валидация сохраненных данных
          if (parsedUser.id && parsedUser.email && parsedUser.name) {
            setUser(parsedUser)
          } else {
            // Очистка поврежденных данных
            localStorage.removeItem('galina-user')
          }
        }
      } catch (error) {
        console.warn('Failed to load saved user session:', error)
        localStorage.removeItem('galina-user')
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)

      // Имитация API вызова - в реальном приложении здесь будет запрос к серверу
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Простая проверка для демо (любой email/password подойдет)
      if (email && password.length >= 6) {
        const mockUser: User = {
          id: crypto.randomUUID(),
          email,
          name: email.split('@')[0]
        }

        setUser(mockUser)
        localStorage.setItem('galina-user', JSON.stringify(mockUser))
        return true
      }

      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = (): void => {
    try {
      setUser(null)
      localStorage.removeItem('galina-user')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value: AuthContextType = {
    user,
    login,
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
