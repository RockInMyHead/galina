import { API_CONFIG } from '@/config/constants'
import { ApiResponse, ChatApiResponse } from '@/types'

/**
 * Generic API request wrapper
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}${
          errorData.error?.message ? ` - ${errorData.error.message}` : ''
        }`
      )
    }

    const data = await response.json()

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('API Request failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Chat API request
 */
export const sendChatMessage = async (
  messages: Array<{
    role: string;
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>
  }>,
  options: {
    model?: string
    max_tokens?: number
    temperature?: number
  } = {}
): Promise<ChatApiResponse> => {
  const result = await apiRequest('/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages,
      model: options.model || 'gpt-3.5-turbo',
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.7,
    }),
  })

  // Если запрос успешен, извлекаем контент из ответа OpenAI
  if (result.success && result.data) {
    try {
      // Проверяем структуру ответа OpenAI API
      if (result.data.choices && result.data.choices[0] && result.data.choices[0].message) {
        const content = result.data.choices[0].message.content
        return {
          success: true,
          data: { content }
        }
      } else {
        return {
          success: false,
          error: 'Неверная структура ответа от AI'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Ошибка обработки ответа AI'
      }
    }
  }

  return result
}

/**
 * Handle API errors consistently
 */
export const handleApiError = (error: any): string => {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.error) return error.error
  return 'Произошла неизвестная ошибка'
}

/**
 * Create standardized error messages
 */
export const createErrorMessage = (code: string, details?: any): string => {
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: 'Ошибка сети. Проверьте подключение к интернету.',
    TIMEOUT_ERROR: 'Превышено время ожидания ответа.',
    AUTH_ERROR: 'Ошибка авторизации. Пожалуйста, войдите снова.',
    FILE_TOO_LARGE: 'Файл слишком большой.',
    INVALID_FILE_TYPE: 'Неподдерживаемый тип файла.',
    PDF_EXTRACTION_FAILED: 'Не удалось обработать PDF файл.',
    CHAT_API_ERROR: 'Ошибка при обращении к AI. Попробуйте позже.',
  }

  return errorMessages[code] || 'Произошла ошибка. Попробуйте еще раз.'
}

// Speech to Text is now handled locally by Web Speech API in the browser
// No backend API calls needed for speech recognition

/**
 * Text to Speech using OpenAI TTS
 */
export const textToSpeech = async (text: string): Promise<Blob | null> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: 'alloy',
        model: 'tts-1',
      }),
    })

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    return audioBlob
  } catch (error) {
    console.error('Text to Speech error:', error)
    return null
  }
}

/**
 * Play audio from blob
 */
export const playAudioBlob = (audioBlob: Blob): Promise<void> => {
  return new Promise((resolve) => {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      resolve()
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      resolve()
    }

    audio.play().catch((error) => {
      console.error('Audio playback error:', error)
      URL.revokeObjectURL(audioUrl)
      resolve()
    })
  })
}

/**
 * Retry mechanism for API calls
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries exceeded')
}
