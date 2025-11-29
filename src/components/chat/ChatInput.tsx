import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Upload, X, FileText, Image, Mic, MicOff, Square } from 'lucide-react'
import { FilePreview } from '@/types'
import { formatFileSize } from '@/utils/fileUtils'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { transcribeAudioWithWhisper } from '@/utils/apiUtils'

interface ChatInputProps {
  message: string
  onMessageChange: (message: string) => void
  onSendMessage: () => void
  onStopStreaming?: () => void
  onVoiceToggle?: () => void
  onFileSelect: (files: File[]) => void
  selectedFiles: FilePreview[]
  onRemoveFile: (index: number) => void
  isLoading: boolean
  isVoiceMode?: boolean
  isListening?: boolean
  isSpeaking?: boolean
  isStreaming?: boolean
  disabled?: boolean
  onVoiceRecordingStart?: () => void
  onVoiceRecordingStop?: (audioBlob?: Blob) => void
  onAudioRecorded?: (audioBlob: Blob) => void
  onVoiceTranscript?: (transcript: string) => void
}

export const ChatInput = ({
  message,
  onMessageChange,
  onSendMessage,
  onFileSelect,
  selectedFiles,
  onRemoveFile,
  isLoading,
  disabled = false,
  onVoiceTranscript,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)

  // Инициализируем систему записи (MediaRecorder + Whisper)
  const audioRecorder = useAudioRecorder({
    onRecordingStart: () => {
      setIsVoiceRecording(true)
      setVoiceError('')
    },
    onRecordingStop: async (blob) => {
      setIsVoiceRecording(false)

      if (blob && blob.size > 0) {
        setIsProcessingAudio(true)
        setVoiceError('🎵 Распознаём вашу речь...')

        try {
          const transcription = await transcribeAudioWithWhisper(blob)
          const text = transcription.trim()

          if (text.length > 0) {
            setVoiceTranscript(text)
            setVoiceError('✅ Распознано успешно! Отправляем...')

            // Автоматически отправляем сообщение сразу после распознавания
            setTimeout(() => {
              onVoiceTranscript?.(text)
              setVoiceError('')
            }, 500)
          } else {
            setVoiceError('❌ Не удалось распознать речь. Попробуйте ещё раз.')
          }
        } catch (error) {
          console.error('❌ Transcription error:', error)
          setVoiceError('❌ Ошибка распознавания. Проверьте подключение к интернету.')
        } finally {
          setIsProcessingAudio(false)
        }
      } else {
        setVoiceError('❌ Запись пуста. Попробуйте ещё раз.')
      }
    },
    onError: (error) => {
      console.error('❌ Audio recorder error:', error)
      setIsVoiceRecording(false)
      setVoiceError(`❌ Ошибка записи: ${error}`)
      setIsProcessingAudio(false)
    }
  })


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  // Обработчик голосовой записи
  const handleVoiceToggle = async () => {
    if (isVoiceRecording) {
      try {
        await audioRecorder.stopRecording()
      } catch (error) {
        console.error('❌ Error stopping recording:', error)
      }
    } else {
      // Проверяем поддержку
      if (!audioRecorder.isSupported) {
        setVoiceError('❌ Запись аудио не поддерживается в этом браузере')
        return
      }

      try {
        setVoiceError('')
        await audioRecorder.startRecording()
      } catch (error) {
        console.error('❌ Failed to start recording:', error)
        setVoiceError('❌ Не удалось начать запись. Проверьте микрофон и разрешения.')
      }
    }
  }

  // Определяем иконку и текст для основной кнопки
  const getMainButtonProps = () => {
    if (message.trim()) {
      // Если есть текст - кнопка отправки
      return {
        icon: <Send className="h-4 w-4" />,
        title: "Отправить сообщение",
        onClick: onSendMessage,
        disabled: isLoading || disabled
      }
    } else {
      // Если нет текста - кнопка микрофона для голосового ввода
      return {
        icon: <Mic className="h-4 w-4" />,
        title: isVoiceRecording ? "Остановить запись" : "Голосовой ввод",
        onClick: handleVoiceToggle,
        disabled: isLoading || disabled,
        isRecording: isVoiceRecording
      }
    }
  }

  const mainButtonProps = getMainButtonProps()

  // Обработчики drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
      setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
      setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFileSelect(files)
    }
  }

  return (
    <div
      className={`space-y-4 transition-colors duration-200 ${
        isDragOver ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-4' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File Previews */}
      {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted rounded-lg p-2 text-sm"
            >
              {file.file.type.startsWith('image/') ? (
                <Image className="h-4 w-4" />
                ) : (
                <FileText className="h-4 w-4" />
                )}
              <span className="truncate max-w-32">{file.file.name}</span>
              <span className="text-muted-foreground">({formatFileSize(file.file.size)})</span>
              <Button
                variant="ghost"
                size="sm"
                  onClick={() => onRemoveFile(index)}
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                >
                <X className="h-3 w-3" />
              </Button>
              </div>
            ))}
        </div>
      )}

      {/* Voice Status Indicator */}
      {(isVoiceRecording || isProcessingAudio || voiceError) && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
          isVoiceRecording
            ? 'text-red-600 bg-red-50 border border-red-200'
            : isProcessingAudio
            ? 'text-blue-600 bg-blue-50 border border-blue-200'
            : voiceError.includes('✅')
            ? 'text-green-600 bg-green-50 border border-green-200'
            : 'text-orange-600 bg-orange-50 border border-orange-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isVoiceRecording || isProcessingAudio ? 'animate-pulse' : ''
          } ${
            isVoiceRecording
              ? 'bg-red-500'
              : isProcessingAudio
              ? 'bg-blue-500'
              : voiceError.includes('✅')
              ? 'bg-green-500'
              : 'bg-orange-500'
          }`}></div>
          <span className="flex-1">
            {isProcessingAudio
              ? '🎵 Распознаём вашу речь...'
              : isVoiceRecording
              ? '🎤 Идёт запись... Говорите сейчас'
              : voiceError
            }
          </span>
          {voiceError && !isVoiceRecording && !isProcessingAudio && !voiceError.includes('✅') && (
            <button
              onClick={() => setVoiceError('')}
              className="px-2 py-1 text-xs hover:opacity-70 transition-opacity"
              title="Закрыть"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Input Area */}
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
          onChange={(e) => e.target.files && onFileSelect(Array.from(e.target.files))}
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ppt,.pptx"
            className="hidden"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled || isVoiceRecording}
            title="Прикрепить файлы"
          >
            <Upload className="h-4 w-4" />
          </Button>


          <Input
            placeholder={
              message.trim()
                ? "Напишите ваш вопрос..."
                : isVoiceRecording
                ? "🎤 Говорите сейчас..."
                : "Напишите ваш вопрос или нажмите микрофон для голосового ввода..."
            }
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className={`flex-1 ${isVoiceRecording ? 'bg-red-50 border-red-300' : ''}`}
          disabled={isLoading || disabled}
            onKeyDown={handleKeyDown}
          />

          <Button
            size="icon"
            className={`shadow-elegant ${
              mainButtonProps.isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : ''
            }`}
            onClick={mainButtonProps.onClick}
            disabled={mainButtonProps.disabled}
            title={mainButtonProps.title}
          >
            {mainButtonProps.icon}
        </Button>
        </div>
    </div>
  )
}