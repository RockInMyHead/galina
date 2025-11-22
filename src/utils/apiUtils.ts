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
    console.log('🔗 API Request:', url)

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    console.log('📡 API Response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = `HTTP ${response.status}: ${response.statusText}${
        errorData.error?.message ? ` - ${errorData.error.message}` : ''
      }`
      console.error('❌ API Error:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = await response.json()

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('❌ API Request failed:', error)
    console.error('🔧 Check if API server is running at:', API_CONFIG.BASE_URL)
    console.error('🔧 Check CORS settings on the API server')
    console.error('🔧 Check SSL certificate if using HTTPS')
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
      model: options.model || 'gpt-5.1',
      reasoning: options.reasoning || 'medium',
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
    SPEECH_RECOGNITION_ERROR: 'Ошибка распознавания речи. Попробуйте еще раз.',
  }

  return errorMessages[code] || 'Произошла ошибка. Попробуйте еще раз.'
}

/**
 * Speech to Text using OpenAI Whisper API
 */
export const speechToText = async (audioBlob: Blob): Promise<string> => {
  try {
    console.log('🎤 Sending audio to Whisper API, size:', audioBlob.size, 'bytes');

    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    const response = await fetch(`${API_CONFIG.BASE_URL}/stt`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Whisper API error:', response.status, errorData);
      throw new Error(errorData.error || 'Speech recognition failed');
    }

    const data = await response.json();

    if (data.success && data.transcription) {
      console.log('✅ Whisper transcription received:', data.transcription.substring(0, 50) + '...');
      return data.transcription;
    } else {
      throw new Error('Invalid response from speech recognition service');
    }
  } catch (error) {
    console.error('❌ Speech to Text error:', error);
    throw error;
  }
}

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
 * Returns true if playback was successful, false if there was an error
 */
export const playAudioBlob = (audioBlob: Blob): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if blob has reasonable size (mock audio is ~48 bytes, real audio is much larger)
    if (audioBlob.size < 1000) {
      console.warn('⚠️ Audio blob too small, likely mock audio:', audioBlob.size, 'bytes')
      resolve(false)
      return
    }

    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    let playbackStarted = false

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      resolve(playbackStarted)
    }

    audio.onerror = () => {
      console.error('Audio playback error: failed to load audio')
      URL.revokeObjectURL(audioUrl)
      resolve(false)
    }

    audio.play().then(() => {
      playbackStarted = true
    }).catch((error) => {
      console.error('Audio playback error:', error.message)
      console.error('Audio blob size:', audioBlob.size, 'bytes')
      console.error('Audio type:', audioBlob.type || 'unknown')

      // Provide more specific error messages
      if (error.name === 'NotSupportedError') {
        console.error('❌ Audio format not supported. This may be due to:')
        console.error('   - Invalid audio data (mock audio instead of real TTS)')
        console.error('   - Browser compatibility issues')
        console.error('   - Corrupted audio stream')
      }

      URL.revokeObjectURL(audioUrl)
      resolve(false)
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

// Document Analysis API functions
export interface DocumentAnalysis {
  id: string
  title: string
  fileName: string
  fileSize: number
  analysis: string
  createdAt: string
  updatedAt: string
}

/**
 * Save document analysis
 */
export const saveDocumentAnalysis = async (
  title: string,
  fileName: string,
  fileSize: number,
  analysis: string
): Promise<DocumentAnalysis> => {
  const result = await apiRequest('/document-analyses', {
    method: 'POST',
    body: JSON.stringify({
      title,
      fileName,
      fileSize,
      analysis,
    }),
  })

  if (result.success && result.data) {
    return result.data.documentAnalysis
  }

  throw new Error(result.error || 'Failed to save document analysis')
}

/**
 * Get all document analyses for user
 */
export const getDocumentAnalyses = async (): Promise<DocumentAnalysis[]> => {
  const result = await apiRequest('/document-analyses')

  if (result.success && result.data) {
    return result.data.analyses
  }

  throw new Error(result.error || 'Failed to get document analyses')
}

/**
 * Get specific document analysis
 */
export const getDocumentAnalysis = async (id: string): Promise<DocumentAnalysis> => {
  const result = await apiRequest(`/document-analyses/${id}`)

  if (result.success && result.data) {
    return result.data.analysis
  }

  throw new Error(result.error || 'Failed to get document analysis')
}

/**
 * Update document analysis title
 */
export const updateDocumentAnalysis = async (id: string, title: string): Promise<void> => {
  const result = await apiRequest(`/document-analyses/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to update document analysis')
  }
}

/**
 * Delete document analysis
 */
export const deleteDocumentAnalysis = async (id: string): Promise<void> => {
  const result = await apiRequest(`/document-analyses/${id}`, {
    method: 'DELETE',
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete document analysis')
  }
}
