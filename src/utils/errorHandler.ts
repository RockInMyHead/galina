import { VALIDATION_MESSAGES } from '@/config/constants'
import { AppError, ValidationError } from '@/types'

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  API_ERROR = 'API_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error messages mapping
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Ошибка сети. Проверьте подключение к интернету.',
  [ErrorCode.VALIDATION_ERROR]: 'Ошибка валидации данных.',
  [ErrorCode.FILE_ERROR]: 'Ошибка обработки файла.',
  [ErrorCode.API_ERROR]: 'Ошибка сервера. Попробуйте позже.',
  [ErrorCode.AUTH_ERROR]: 'Ошибка авторизации. Пожалуйста, войдите снова.',
  [ErrorCode.UNKNOWN_ERROR]: 'Произошла неизвестная ошибка.',
}

/**
 * Create a standardized error object
 */
export const createError = (
  code: ErrorCode,
  message?: string,
  details?: any
): AppError => ({
  code,
  message: message || ERROR_MESSAGES[code],
  details,
})

/**
 * Handle and log errors consistently
 */
export const handleError = (error: any, context?: string): AppError => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error)

  if (error?.code && Object.values(ErrorCode).includes(error.code)) {
    return error as AppError
  }

  if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
    return createError(ErrorCode.NETWORK_ERROR, error.message)
  }

  if (error?.status === 401 || error?.status === 403) {
    return createError(ErrorCode.AUTH_ERROR)
  }

  if (error?.status >= 400 && error?.status < 500) {
    return createError(ErrorCode.VALIDATION_ERROR, error.message)
  }

  if (error?.status >= 500) {
    return createError(ErrorCode.API_ERROR)
  }

  return createError(ErrorCode.UNKNOWN_ERROR, error?.message)
}

/**
 * Handle validation errors
 */
export const handleValidationError = (field: string, rule: keyof typeof VALIDATION_MESSAGES, params?: any): ValidationError => ({
  field,
  message: typeof VALIDATION_MESSAGES[rule] === 'function'
    ? (VALIDATION_MESSAGES[rule] as Function)(params)
    : VALIDATION_MESSAGES[rule],
})

/**
 * Handle file-related errors
 */
export const handleFileError = (fileName: string, error: any): AppError => {
  if (error?.message?.includes('size')) {
    return createError(ErrorCode.FILE_ERROR, `Файл ${fileName} слишком большой`)
  }

  if (error?.message?.includes('type')) {
    return createError(ErrorCode.FILE_ERROR, `Неподдерживаемый тип файла: ${fileName}`)
  }

  return createError(ErrorCode.FILE_ERROR, `Ошибка обработки файла ${fileName}`)
}

/**
 * Show user-friendly error message
 */
export const getErrorMessage = (error: AppError): string => {
  return error.message
}

/**
 * Log error for debugging (only in development)
 */
export const logError = (error: AppError, additionalData?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 Error Details')
    console.error('Code:', error.code)
    console.error('Message:', error.message)
    if (error.details) console.error('Details:', error.details)
    if (additionalData) console.error('Additional Data:', additionalData)
    console.groupEnd()
  }
}

/**
 * Error boundary helper
 */
export const withErrorBoundary = <T extends any[], R>(
  fn: (...args: T) => R,
  fallback?: R
) => {
  return (...args: T): R => {
    try {
      return fn(...args)
    } catch (error) {
      console.error('Error in function execution:', error)
      return fallback as R
    }
  }
}
