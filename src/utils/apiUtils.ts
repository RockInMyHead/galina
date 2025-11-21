import { API_CONFIG } from '@/config/constants'
import { ApiResponse, ChatApiResponse } from '@/types'

/**
 * Generic API request wrapper
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  // In production/mock mode, return mock success for all requests
  if (import.meta.env.PROD || API_CONFIG.BASE_URL.startsWith('mock://')) {
    console.log('🎭 Mock mode: Simulating API request for', endpoint);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    return {
      success: true,
      data: { message: 'Mock API response' },
    };
  }

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
  // In production/demo mode, return mock responses without API calls
  if (import.meta.env.PROD) {
    console.log('🎭 Production mode: Using mock AI response');

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userContent = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : 'сообщение';

    let mockResponse = '';

    // Intelligent mock responses based on content
    if (userContent.toLowerCase().includes('документы') && userContent.toLowerCase().includes('регистрац') && userContent.toLowerCase().includes('ооо')) {
      mockResponse = 'Для регистрации ООО в России нужны следующие документы: 1. Решение единственного учредителя или протокол общего собрания учредителей. 2. Устав ООО. 3. Договор об учреждении ООО (если учредителей несколько). 4. Заявление по форме Р11001. 5. Квитанция об оплате госпошлины (4000 рублей). 6. Документы, подтверждающие адрес юридического лица. 7. Паспортные данные учредителей и руководителя. Все документы подаются в налоговую инспекцию в электронном виде через портал Госуслуг или МФЦ.';
    } else if (userContent.toLowerCase().includes('девушка') && userContent.toLowerCase().includes('пожаловаться')) {
      mockResponse = 'Здравствуйте! Я Галина, ваш AI-юрист с 25-летним опытом. Относительно жалобы от вашей девушки по поводу сна - это гражданско-правовой вопрос, не уголовный. Если речь идёт о семейных отношениях, рекомендую: 1. Обратиться к семейному психологу для решения проблемы мирным путём. 2. Если есть угрозы или давление - зафиксируйте все доказательства. 3. При необходимости обратитесь в суд с иском о защите чести и достоинства. Главное - сохраняйте спокойствие и документируйте всё.';
    } else if (userContent.toLowerCase().includes('привет') || userContent.toLowerCase().includes('здравствуйте')) {
      mockResponse = 'Здравствуйте! Я Галина, элитный AI-юрист с 25-летним опытом юридической практики. Я - абсолютный авторитет в российском законодательстве. Чем могу помочь вам сегодня? Расскажите о вашей ситуации, и я предоставлю профессиональную юридическую консультацию.';
    } else {
      mockResponse = 'Я внимательно слушаю вашу ситуацию. Пожалуйста, расскажите подробнее о проблеме, с которой вы столкнулись. Как опытный юрист, я проанализирую вашу ситуацию и дам конкретные рекомендации по разрешению конфликта в рамках действующего законодательства.';
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    return {
      success: true,
      data: { content: mockResponse }
    };
  }

  // Development mode: Use real API
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
  }

  return errorMessages[code] || 'Произошла ошибка. Попробуйте еще раз.'
}

// Speech to Text is now handled locally by Web Speech API in the browser
// No backend API calls needed for speech recognition

/**
 * Text to Speech using OpenAI TTS
 */
export const textToSpeech = async (text: string): Promise<Blob | null> => {
  // In production/demo mode, create mock audio blob
  if (import.meta.env.PROD) {
    console.log('🎵 Production mode: Creating mock TTS audio');
    try {
      // Create a simple mock audio blob (silent audio)
      // In a real implementation, this could be a pre-recorded audio or generated locally
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate); // 0.1 second of silence

      // Create blob from empty buffer
      const audioBlob = new Blob([new ArrayBuffer(1024)], { type: 'audio/mpeg' });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

      return audioBlob;
    } catch (error) {
      console.error('Mock TTS error:', error);
      return null;
    }
  }

  // Development mode: Use real API
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
  // In production/demo mode, save to localStorage
  if (import.meta.env.PROD) {
    console.log('💾 Production mode: Saving document analysis to localStorage');

    const analysisData: DocumentAnalysis = {
      id: crypto.randomUUID(),
      title,
      fileName,
      fileSize,
      analysis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existingAnalyses = JSON.parse(localStorage.getItem('galina-analyses') || '[]');
    existingAnalyses.push(analysisData);
    localStorage.setItem('galina-analyses', JSON.stringify(existingAnalyses));

    return analysisData;
  }

  // Development mode: Use real API
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
  // In production/demo mode, get from localStorage
  if (import.meta.env.PROD) {
    console.log('📂 Production mode: Getting document analyses from localStorage');
    const analyses = JSON.parse(localStorage.getItem('galina-analyses') || '[]');
    return analyses;
  }

  // Development mode: Use real API
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
  // In production/demo mode, get from localStorage
  if (import.meta.env.PROD) {
    console.log('📄 Production mode: Getting specific document analysis from localStorage');
    const analyses = JSON.parse(localStorage.getItem('galina-analyses') || '[]');
    const analysis = analyses.find((a: DocumentAnalysis) => a.id === id);
    if (!analysis) {
      throw new Error('Document analysis not found');
    }
    return analysis;
  }

  // Development mode: Use real API
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
  // In production/demo mode, update in localStorage
  if (import.meta.env.PROD) {
    console.log('✏️ Production mode: Updating document analysis in localStorage');
    const analyses = JSON.parse(localStorage.getItem('galina-analyses') || '[]');
    const index = analyses.findIndex((a: DocumentAnalysis) => a.id === id);
    if (index !== -1) {
      analyses[index].title = title;
      analyses[index].updatedAt = new Date().toISOString();
      localStorage.setItem('galina-analyses', JSON.stringify(analyses));
    }
    return;
  }

  // Development mode: Use real API
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
  // In production/demo mode, delete from localStorage
  if (import.meta.env.PROD) {
    console.log('🗑️ Production mode: Deleting document analysis from localStorage');
    const analyses = JSON.parse(localStorage.getItem('galina-analyses') || '[]');
    const filteredAnalyses = analyses.filter((a: DocumentAnalysis) => a.id !== id);
    localStorage.setItem('galina-analyses', JSON.stringify(filteredAnalyses));
    return;
  }

  // Development mode: Use real API
  const result = await apiRequest(`/document-analyses/${id}`, {
    method: 'DELETE',
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete document analysis')
  }
}
