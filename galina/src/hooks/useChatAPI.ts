import { useState, useCallback } from 'react'
import { ChatMessage as ChatMessageType } from '@/types/chat'
import { API_CONFIG } from '@/config/constants'
import { chatStorage } from '@/utils/storageUtils'

interface UseChatAPIResult {
  messages: ChatMessageType[]
  isLoading: boolean
  error: string | null
  fetchMessages: () => Promise<ChatMessageType[]>
  sendMessage: (content: string, role: 'user' | 'assistant', files?: any[]) => Promise<ChatMessageType | null>
  clearMessages: () => Promise<boolean>
}

/**
 * Hook for managing chat messages with API sync
 */
export const useChatAPI = (): UseChatAPIResult => {
  const [messages, setMessages] = useState<ChatMessageType[]>(() => chatStorage.get() || [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch messages from API
  const fetchMessages = useCallback(async (): Promise<ChatMessageType[]> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/history`)
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`)
      }

      const data = await response.json()
      const apiMessages: ChatMessageType[] = data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.timestamp)
      }))

      // Update local state and storage
      setMessages(apiMessages)
      chatStorage.set(apiMessages)

      return apiMessages
    } catch (err) {
      console.error('Error fetching messages from API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Fallback to localStorage
      const localMessages = chatStorage.get() || []
      setMessages(localMessages)
      return localMessages
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Send message via API
  const sendMessage = useCallback(async (
    content: string,
    role: 'user' | 'assistant',
    files: any[] = []
  ): Promise<ChatMessageType | null> => {
    // Create message locally first for immediate UI update
    const localMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      content,
      role,
      timestamp: new Date()
    }

    // Update local state immediately
    const updatedMessages = [...messages, localMessage]
    setMessages(updatedMessages)
    chatStorage.set(updatedMessages)

    try {
      setIsLoading(true)
      setError(null)

      const messageData = {
        content,
        role,
        files: files.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          content: file.content // base64 encoded
        }))
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      })

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`)
      }

      const data = await response.json()
      const serverMessage: ChatMessageType = {
        id: data.message.id,
        content: data.message.content,
        role: data.message.role,
        timestamp: new Date(data.message.timestamp)
      }

      // Update with server response (replace local message)
      const finalMessages = messages.map(msg =>
        msg.id === localMessage.id ? serverMessage : msg
      )
      setMessages(finalMessages)
      chatStorage.set(finalMessages)

      return serverMessage
    } catch (err) {
      console.error('Error sending message via API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Add to offline queue if offline
      if (!navigator.onLine) {
        import('@/utils/syncService').then(({ syncService }) => {
          syncService.addToOfflineQueue({
            type: 'chat_message',
            data: {
              content,
              role,
              files: files.map(file => ({
                name: file.name,
                type: file.type,
                size: file.size,
                content: file.content
              }))
            }
          })
          console.log('📋 Message queued for offline sync')
        }).catch(err => {
          console.error('Failed to import syncService:', err)
        })
      }

      // Return locally created message
      return localMessage
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  // Clear messages via API
  const clearMessages = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/history`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to clear messages: ${response.status}`)
      }

      // Clear local state and storage
      setMessages([])
      chatStorage.clear()

      return true
    } catch (err) {
      console.error('Error clearing messages via API:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Fallback to localStorage
      setMessages([])
      chatStorage.clear()
      return true
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    isLoading,
    error,
    fetchMessages,
    sendMessage,
    clearMessages,
  }
}
