import { useState, useRef, useCallback } from 'react'
import { validateFile, processFile, formatFileSize, getFileTypeDisplayName } from '@/utils/fileUtils'
import { FilePreview, ProcessedFile } from '@/types'

interface UseFileUploadOptions {
  maxFiles?: number
  onFileProcessed?: (file: ProcessedFile) => void
  onError?: (error: string) => void
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const { maxFiles = 5, onFileProcessed, onError } = options

  const [files, setFiles] = useState<FilePreview[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)

    if (files.length + fileArray.length > maxFiles) {
      const error = `Максимум ${maxFiles} файлов`
      onError?.(error)
      return
    }

    setIsProcessing(true)

    try {
      const validFiles = []
      const errors = []

      for (const file of fileArray) {
        const validation = validateFile(file)
        if (validation.isValid) {
          validFiles.push(file)
        } else {
          errors.push(`${file.name}: ${validation.error}`)
        }
      }

      if (errors.length > 0) {
        onError?.(errors.join('\n'))
      }

      if (validFiles.length > 0) {
        const previews: FilePreview[] = validFiles.map(file => ({
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        }))

        setFiles(prev => [...prev, ...previews])

        // Process files in background
        for (const file of validFiles) {
          try {
            const processed = await processFile(file)
            onFileProcessed?.(processed)
          } catch (error) {
            console.error('Error processing file:', error)
            onError?.(`Ошибка обработки файла ${file.name}`)
          }
        }
      }
    } catch (error) {
      console.error('Error adding files:', error)
      onError?.('Ошибка при добавлении файлов')
    } finally {
      setIsProcessing(false)
    }
  }, [files.length, maxFiles, onFileProcessed, onError])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }, [])

  const clearFiles = useCallback(() => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
    })
    setFiles([])
  }, [files])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const getTotalSize = useCallback(() => {
    return files.reduce((total, file) => total + file.file.size, 0)
  }, [files])

  const getFormattedTotalSize = useCallback(() => {
    return formatFileSize(getTotalSize())
  }, [getTotalSize])

  return {
    files,
    isProcessing,
    fileInputRef,
    addFiles,
    removeFile,
    clearFiles,
    openFileDialog,
    getTotalSize,
    getFormattedTotalSize,
    formatFileSize,
    getFileTypeDisplayName,
  }
}
