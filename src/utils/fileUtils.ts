import { FILE_CONFIG } from '@/config/constants'
import { FileValidationResult, ProcessedFile } from '@/types'
import * as pdfjsLib from 'pdfjs-dist'

// Initialize PDF.js worker - use stable CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

/**
 * Validates a file based on size and type
 */
export const validateFile = (file: File): FileValidationResult => {
  // Check file size
  if (file.size > FILE_CONFIG.MAX_SIZE) {
    return {
      isValid: false,
      error: `Файл слишком большой. Максимальный размер: ${FILE_CONFIG.MAX_SIZE / (1024 * 1024)}MB`
    }
  }

  // Check file type
  const isAllowedType = FILE_CONFIG.ALLOWED_TYPES.includes(file.type) ||
    FILE_CONFIG.ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))

  if (!isAllowedType) {
    return {
      isValid: false,
      error: 'Неподдерживаемый тип файла. Поддерживаются: изображения, PDF, TXT, DOC, DOCX'
    }
  }

  return { isValid: true }
}

/**
 * Converts a File to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Reads text content from a file
 */
export const fileToText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string || ''
      resolve(content)
    }
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * Processes a file and returns structured data
 */
export const processFile = async (file: File): Promise<ProcessedFile> => {
  const validation = validateFile(file)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  let content = ''
  let type: ProcessedFile['type'] = 'document'

  if (file.type.startsWith('image/')) {
    type = 'image'
    try {
    content = await fileToBase64(file)
    } catch (error) {
      console.error('Error processing image:', error)
      content = `Изображение: ${file.name} (${formatFileSize(file.size)}) - не удалось обработать`
    }
  } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    type = 'text'
    try {
    content = await fileToText(file)
    } catch (error) {
      console.error('Error processing text file:', error)
      content = `Текстовый файл: ${file.name} - не удалось прочитать содержимое`
    }
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    type = 'pdf'
    try {
    content = await extractTextFromPDF(file)
      console.log('PDF processed successfully, content length:', content.length)
    } catch (error) {
      console.error('Error processing PDF:', error)
      content = `PDF документ: ${file.name} (${formatFileSize(file.size)}) - ${error.message}`
    }
  } else {
    type = 'document'
    try {
    content = await fileToText(file)
    } catch (error) {
      console.error('Error processing document:', error)
      content = `Документ: ${file.name} (${formatFileSize(file.size)}, тип: ${file.type}) - не удалось извлечь содержимое`
    }
  }

  return {
    file,
    content,
    type
  }
}

/**
 * Extracts text from PDF file using PDF.js
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  console.log('Starting PDF extraction for file:', file.name, 'size:', file.size)
  console.log('PDF.js version:', pdfjsLib.version)
  console.log('Worker source:', pdfjsLib.GlobalWorkerOptions.workerSrc)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        console.log('FileReader loaded, processing PDF...')
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
        console.log('Created Uint8Array, loading PDF document...')

        // Check file size before processing
        if (file.size > 50 * 1024 * 1024) { // 50MB limit for PDF processing
          reject(new Error('PDF файл слишком большой для обработки (максимум 50MB)'))
          return
        }

        console.log('Loading PDF with PDF.js...')

        // Try loading with different options
        let pdf
        try {
          // Add timeout for PDF loading (60 seconds for large files)
          const loadingTask = pdfjsLib.getDocument({
            data: typedArray,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
          })

          // Set timeout for loading
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              loadingTask.destroy()
              reject(new Error('Превышено время ожидания загрузки PDF (60 секунд)'))
            }, 60000) // 60 second timeout
          })

          pdf = await Promise.race([loadingTask.promise, timeoutPromise])
          console.log('PDF loaded successfully')
        } catch (loadError) {
          console.error('PDF loading error:', loadError)
          reject(new Error(`Ошибка загрузки PDF: ${loadError.message}`))
          return
        }

        console.log('PDF loaded successfully, pages:', pdf.numPages)

        let fullText = ''

        // Limit to 50 pages max to prevent excessive processing
        const maxPages = Math.min(pdf.numPages, 50)

        // Extract text from each page with timeout protection
        for (let i = 1; i <= maxPages; i++) {
          try {
            console.log(`Processing page ${i}/${maxPages}`)

            // Add timeout for page processing
            const pagePromise = pdf.getPage(i)
            const pageTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout processing page ${i}`)), 10000)
            )

            const page = await Promise.race([pagePromise, pageTimeout])
          const textContent = await page.getTextContent()

          const pageText = textContent.items
              .filter((item: any) => item.str && item.str.trim())
              .map((item: any) => item.str.trim())
            .join(' ')
              .replace(/\s+/g, ' ') // Normalize whitespace

            if (pageText.trim()) {
          fullText += `${pageText}\n`
              console.log(`Page ${i} extracted ${pageText.length} characters`)
            } else {
              console.log(`Page ${i} contains no extractable text`)
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError.message)
            // Continue with other pages
          }
        }

        const finalText = fullText.trim()
        console.log('PDF extraction complete, total text length:', finalText.length)

        if (finalText.length === 0) {
          resolve('Текст не найден в PDF документе. Возможно, документ содержит только изображения, сканированный текст или защищен от копирования.')
        } else if (finalText.length < 100) {
          resolve(`Найден текст: "${finalText}". Возможно, PDF содержит в основном изображения или имеет ограничения на копирование.`)
        } else {
        resolve(finalText)
        }
      } catch (error) {
        console.error('Error extracting text from PDF:', error)
        reject(new Error(`Не удалось извлечь текст из PDF файла: ${error.message}`))
      }
    }
    reader.onerror = () => {
      console.error('FileReader error for PDF')
      reject(new Error('Ошибка чтения PDF файла'))
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Formats file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Gets file type display name
 */
export const getFileTypeDisplayName = (file: File): string => {
  if (file.type.startsWith('image/')) return 'Изображение'
  if (file.type === 'application/pdf') return 'PDF документ'
  if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'Word документ'
  if (file.type === 'text/plain') return 'Текстовый файл'
  return 'Файл'
}
