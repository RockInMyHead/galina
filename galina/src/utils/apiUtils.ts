import { API_CONFIG } from '@/config/constants'
import { ApiResponse, ChatApiResponse } from '@/types'

/**
 * Helper function to clear auth data on 403 errors
 */
const clearAuthOnForbidden = () => {
  try {
    localStorage.removeItem('galina-token')
    localStorage.removeItem('galina-user')
    console.warn('🔐 Auth data cleared due to 403 Forbidden response')
  } catch (e) {
    console.warn('Failed to clear auth data:', e)
  }
}

/**
 * Unified chat API client with SSE streaming support
 */
export interface ChatApiOptions {
  messages: any[];
  model?: string;
  stream?: boolean;
  max_completion_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export const sendStreamingMessageToAI = async (options: ChatApiOptions) => {
  const {
    messages,
    model = 'gpt-5.1',
    stream = false,
    max_completion_tokens = 1500,
    temperature = 0.7,
    signal
  } = options;

  const requestBody = {
    messages,
    model,
    max_completion_tokens,
    temperature,
    stream
  };

  const url = `${API_CONFIG.BASE_URL}/chat`;

  try {
    const token = localStorage.getItem('galina-token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token && token !== 'demo-token') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }

      // Handle auth errors
      if (response.status === 401 || response.status === 403) {
        clearAuthOnForbidden();
      }

      throw new Error(errorMessage);
    }

    if (!stream) {
      // Non-streaming response
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return content;
    }

    // Streaming response with SSE parsing
    return new Promise<string>((resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('Response body is not readable'));
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              resolve(fullContent);
              break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) {
                continue;
              }

              const jsonStr = line.substring(6);
              try {
                const data = JSON.parse(jsonStr);

                if (data.content) {
                  fullContent += data.content;
                  onChunk?.(data.content);
                }

                if (data.finished || data.done) {
                  resolve(fullContent);
                  return;
                }
              } catch (e) {
                // Ignore malformed chunks
                console.warn('⚠️ Malformed SSE chunk:', jsonStr.substring(0, 50));
              }
            }
          }
        } catch (error) {
          reject(error);
        } finally {
          try {
            reader.releaseLock();
          } catch (e) {
            console.warn('Failed to release reader lock:', e);
          }
        }
      };

      readStream().catch(reject);
    });

  } catch (error: any) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }

    // Handle Safari-specific CORS errors
    if (error instanceof TypeError && error.message.includes('CORS')) {
      console.error('🚫 CORS Error detected (Safari compatibility issue):', error.message);
      throw new Error('Safari CORS Error: Please check browser security settings or try Chrome/Firefox');
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('🌐 Network Error detected:', error.message);
      throw new Error('Network Error: Please check your internet connection');
    }

    throw error;
  }
};
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

    // Add Authorization header if token exists
    const token = localStorage.getItem('galina-token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    console.log('📡 API Response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Only clear auth data for actual auth errors (401/403), not OpenAI API errors (500)
      // OpenAI API errors are converted to 500 on the server to avoid confusion
      if ((response.status === 401 || response.status === 403) && !errorData.openai_status) {
        clearAuthOnForbidden()
      }

      const errorMsg = errorData.message || errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      console.error('❌ API Error:', errorMsg)
      
      // Include OpenAI API status in error message if present
      if (errorData.openai_status) {
        console.error('🔑 OpenAI API returned status:', errorData.openai_status)
      }
      
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
export const sendStreamingMessage = async (
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
    max_completion_tokens?: number
    temperature?: number
  } = {}
): Promise<ChatApiResponse> => {
  const result = await apiRequest('/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages,
      model: options.model || 'gpt-5.1',
      max_completion_tokens: options.max_completion_tokens || 2000,
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
    console.log('🎵 Requesting TTS for text:', text.substring(0, 50))

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

    console.log('🎵 TTS API response:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    console.log('🎵 TTS blob created:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isValid: audioBlob.size > 100
    })

    return audioBlob
  } catch (error) {
    console.error('❌ Text to Speech error:', error)
    return null
  }
}

/**
 * Play audio from blob
 */
export const playAudioBlob = (audioBlob: Blob): Promise<void> => {
  return new Promise((resolve) => {
    console.log('🎵 Attempting to play audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isValid: audioBlob.size > 100
    })

    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    audio.onended = () => {
      console.log('✅ Audio playback completed successfully')
      URL.revokeObjectURL(audioUrl)
      resolve()
    }

    audio.onerror = (event) => {
      console.error('❌ Audio element error:', event)
      URL.revokeObjectURL(audioUrl)
      resolve()
    }

    audio.oncanplay = () => {
      console.log('✅ Audio can play, starting playback...')
    }

    audio.oncanplaythrough = () => {
      console.log('✅ Audio fully loaded and can play through')
    }

    audio.onloadstart = () => {
      console.log('🔄 Audio loading started')
    }

    audio.onload = () => {
      console.log('✅ Audio loaded')
    }

    audio.play().catch((error) => {
      console.error('❌ Audio play() failed:', {
        error: error.message,
        name: error.name,
        audioError: audio.error,
        audioState: {
          readyState: audio.readyState,
          networkState: audio.networkState,
          duration: audio.duration,
          src: audio.src ? 'set' : 'not set'
        }
      })
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

/**
 * Transcribe audio using OpenAI Whisper API
 */
export const transcribeAudioWithWhisper = async (audioBlob: Blob): Promise<string> => {
  try {
    console.log('🎵 Sending audio to OpenAI Whisper API...')

    // Определение расширения по MIME типу
    let extension = 'webm'
    if (audioBlob.type.includes('mp4') || audioBlob.type.includes('aac') || audioBlob.type.includes('m4a')) {
      extension = 'm4a'
    } else if (audioBlob.type.includes('wav')) {
      extension = 'wav'
    } else if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
      extension = 'mp3'
    } else if (audioBlob.type.includes('ogg')) {
      extension = 'ogg'
    }

    // Создание File из Blob
    const file = new File([audioBlob], `voice-message.${extension}`, { type: audioBlob.type })
    console.debug(`[OpenAI] Отправляется аудио на транскрибацию (${file.type}, size: ${file.size})`)

    // Используем прямой fetch вместо OpenAI клиента для совместимости
    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', 'whisper-1')
    formData.append('language', 'ru')
    formData.append('response_format', 'text')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Whisper API error:', response.status, errorText)
      throw new Error(`Whisper API error: ${response.status}`)
    }

    const transcription = await response.text()
    console.log('✅ Whisper transcription received:', transcription.trim())

    if (!transcription.trim()) {
      throw new Error('Empty transcription result')
    }

    return transcription.trim()

  } catch (error) {
    console.error('❌ Whisper transcription failed:', error)
    throw error
  }
}

/**
 * Mock API responses for standalone mode
 */
function mockApiResponse<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  console.log('🎭 Mocking API response for:', endpoint)

  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock responses based on endpoint
      if (endpoint === '/auth/register') {
        resolve({
          success: true,
          data: {
            user: {
              id: 'demo-user',
              email: 'demo@galina.ai',
              name: 'Demo User'
            },
            token: 'demo-jwt-token-for-testing'
          }
        })
      } else if (endpoint === '/auth/login') {
        resolve({
          success: true,
          data: {
            user: {
              id: 'demo-user',
              email: 'demo@galina.ai',
              name: 'Demo User'
            },
            token: 'demo-jwt-token-for-testing'
          }
        })
      } else if (endpoint === '/user/profile') {
        resolve({
          success: true,
          data: {
            user: {
              id: 'demo-user',
              email: 'demo@galina.ai',
              name: 'Demo User'
            },
            balance: { amount: 1500, currency: 'RUB' },
            preferences: {
              learning_style: 'visual',
              difficulty_level: 'intermediate',
              interests: ['юридические консультации']
            }
          }
        })
      } else if (endpoint === '/user/balance') {
        resolve({
          success: true,
          data: { amount: 1500, currency: 'RUB' }
        })
      } else if (endpoint === '/chat') {
        // Mock chat response - this will be handled by the actual LLM service
        resolve({
          success: false,
          error: 'Chat functionality requires API server'
        })
      } else if (endpoint === '/tts') {
        resolve({
          success: false,
          error: 'TTS functionality requires API server'
        })
      } else {
        resolve({
          success: false,
          error: `Endpoint ${endpoint} not available in standalone mode`
        })
      }
    }, 500) // Simulate 500ms delay
  })
}

/**
 * Send chat message to API
 */
export const sendChatMessage = async (
  content: string,
  messages: any[],
  files: any[] = [],
  signal?: AbortSignal
): Promise<any> => {
  try {
    const token = localStorage.getItem('galina-token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({
        content,
        messages,
        files: files.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          content: file.content // base64 encoded
        }))
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('sendChatMessage error:', error);
    throw error;
  }
}
