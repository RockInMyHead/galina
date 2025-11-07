import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Upload, X, Mic, FileText, Image, Square } from 'lucide-react'
import { FilePreview } from '@/types'
import { formatFileSize } from '@/utils/fileUtils'

interface ChatInputProps {
  message: string
  onMessageChange: (message: string) => void
  onSendMessage: () => void
  onStopStreaming?: () => void
  onVoiceToggle: () => void
  onFileSelect: (files: FileList) => void
  selectedFiles: FilePreview[]
  onRemoveFile: (index: number) => void
  isLoading: boolean
  isVoiceMode: boolean
  isListening: boolean
  isSpeaking: boolean
  isStreaming?: boolean
  disabled?: boolean
  onVoiceRecordingStart?: () => void
  onVoiceRecordingStop?: (audioBlob?: Blob) => void
}

export const ChatInput = ({
  message,
  onMessageChange,
  onSendMessage,
  onStopStreaming,
  onVoiceToggle,
  onFileSelect,
  selectedFiles,
  onRemoveFile,
  isLoading,
  isVoiceMode,
  isListening,
  isSpeaking,
  isStreaming = false,
  disabled = false,
  onVoiceRecordingStart,
  onVoiceRecordingStop,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  // Обработчики drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isLoading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isLoading) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || isLoading) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFileSelect(files as any)
    }
  }

  // Функции для голосовой записи
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Настройка анализатора для визуализации
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyserRef.current = analyser

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        onVoiceRecordingStop?.(audioBlob)
        stream.getTracks().forEach(track => track.stop())
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      onVoiceRecordingStart?.()

      // Таймер записи
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // Визуализация аудио уровня
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255) // Нормализация 0-1
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
        }
      }
      updateAudioLevel()

    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Не удалось начать запись. Проверьте разрешения на микрофон.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      setAudioLevel(0)
    }
  }

  // Обработчики touch событий для мобильных
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!isLoading && !isRecording && !message.trim() && selectedFiles.length === 0) {
      startRecording()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    if (isRecording) {
      stopRecording()
    }
  }

  // Форматирование времени записи
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getButtonState = () => {
    if (isStreaming) return 'stop-streaming'
    if (isRecording) return 'recording'
    if (isSpeaking) return 'speaking'
    if (isVoiceMode) return 'voice-ready'
    if (isListening) return 'listening'
    if (message.trim() || selectedFiles.length > 0) return 'send'
    return 'voice'
  }

  const buttonState = getButtonState()

  return (
    <div
      className={`space-y-4 transition-colors duration-200 ${
        isDragOver ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-4' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Indicator */}
      {isDragOver && (
        <div className="flex items-center justify-center py-8 text-center">
          <div className="space-y-2">
            <Upload className="h-12 w-12 mx-auto text-primary animate-bounce" />
            <p className="text-lg font-medium text-primary">Перетащите файлы сюда</p>
            <p className="text-sm text-muted-foreground">
              Поддерживаются изображения, PDF, документы Word/Excel/PowerPoint, текстовые файлы
            </p>
          </div>
        </div>
      )}

      {/* File Preview Area */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Прикрепленные файлы:</p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((filePreview, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg max-w-xs">
                {filePreview.preview ? (
                  <img
                    src={filePreview.preview}
                    alt={filePreview.file.name}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <FileText className="w-4 h-4 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{filePreview.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(filePreview.file.size)}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveFile(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Recording Visualization */}
      {isRecording && (
        <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Запись...</span>
            <span className="text-sm">{formatTime(recordingTime)}</span>
          </div>

          {/* Audio Wave Visualization */}
          <div className="flex items-center gap-1 flex-1 max-w-xs">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(4, audioLevel * 40)}px`,
                  animationDelay: `${i * 50}ms`
                }}
              />
            ))}
          </div>

          <div className="text-xs text-red-500">
            Отпустите для отправки
          </div>
        </div>
      )}

      {/* Input Area */}
      {!isRecording && (
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && onFileSelect(e.target.files)}
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ppt,.pptx"
            className="hidden"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled}
            title="Прикрепить файлы"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Input
            placeholder="Напишите ваш вопрос..."
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="flex-1"
            disabled={isLoading || isListening || isSpeaking || disabled}
            onKeyDown={handleKeyDown}
          />

          <Button
            size="icon"
          className={`shadow-elegant ${
            buttonState === 'recording' ? 'bg-red-500 hover:bg-red-600 animate-pulse' :
            buttonState === 'stop-streaming' ? 'bg-red-500 hover:bg-red-600 animate-pulse' :
            buttonState === 'listening' ? 'bg-blue-500 hover:bg-blue-600 animate-pulse' :
            buttonState === 'voice-ready' ? 'bg-green-500 hover:bg-green-600' :
            buttonState === 'speaking' ? 'bg-purple-500 hover:bg-purple-600' :
            buttonState === 'send' ? '' : ''
          }`}
          onClick={
            buttonState === 'stop-streaming' ? (onStopStreaming || (() => {})) :
            buttonState === 'voice' ? onVoiceToggle :
            onSendMessage
          }
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          disabled={isLoading || isSpeaking || (isListening && !isVoiceMode) || disabled || (isStreaming && !onStopStreaming)}
          title={
            isRecording ? "Отпустите для отправки" :
            isStreaming ? "Остановить генерацию" :
            isSpeaking ? "Галина говорит..." :
            isVoiceMode ? "Отправить вопрос" :
            isListening ? "Слушаю..." :
            message.trim() || selectedFiles.length > 0 ? "Отправить сообщение" :
            "Зажмите для голосового ввода"
          }
        >
          {buttonState === 'recording' ? (
            <Send className="h-4 w-4" />
          ) : buttonState === 'stop-streaming' ? (
            <Square className="h-4 w-4" />
          ) : isSpeaking ? (
            <div className="flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce mr-1"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          ) : isVoiceMode || buttonState === 'send' ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        </div>
      )}
    </div>
  )
}
