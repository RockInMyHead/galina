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

  // Инициализируем профессиональную систему записи (MediaRecorder + Whisper)
  const audioRecorder = useAudioRecorder({
    onRecordingStart: () => {
      console.log('🎤 Professional audio recording started')
      setIsVoiceRecording(true)
      setVoiceError('') // Очищаем предыдущие ошибки
      setVoiceError('🎤 Запись начата... Говорите сейчас')
    },
    onRecordingStop: async (blob) => {
      console.log('🎤 Audio recording stopped, blob size:', blob?.size)
      setIsVoiceRecording(false)

      if (blob && blob.size > 0) {
        setIsProcessingAudio(true)
        setVoiceError('🎵 Обрабатываем ваше сообщение...')

        try {
          console.log('🎵 Starting transcription with OpenAI Whisper...')
          const transcription = await transcribeAudioWithWhisper(blob)
          const text = transcription.trim()

          console.log('✅ Whisper transcription result:', text)

          if (text.length > 0) {
            console.log('📝 Sending transcribed message:', text)
            setVoiceTranscript(text)
            setVoiceError('✅ Сообщение готово!')
            onVoiceTranscript?.(text)

            // Автоматически вставляем текст и отправляем через 1 секунду
            setTimeout(() => {
              onMessageChange(text)
              setVoiceError('')
            }, 1000)
          } else {
            console.log('⚠️ Empty transcription result')
            setVoiceError('❌ Не удалось распознать речь. Попробуйте говорить четче.')
          }
        } catch (error) {
          console.error('❌ Transcription error:', error)
          setVoiceError('❌ Ошибка распознавания речи. Попробуйте еще раз.')
        } finally {
          setIsProcessingAudio(false)
        }
      } else {
        console.log('⚠️ Audio blob is empty')
        setVoiceError('❌ Запись пуста. Попробуйте еще раз.')
      }
    },
    onError: (error) => {
      console.error('❌ Audio recorder error:', error)
      setIsVoiceRecording(false)
      setVoiceError(`❌ Ошибка: ${error}`)
      setIsProcessingAudio(false)
    }
  })


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  // Обработчик голосовой записи (только MediaRecorder + Whisper)
  const handleVoiceToggle = async () => {
    if (isVoiceRecording) {
      console.log('🎤 Stopping professional voice recording')
      try {
        await audioRecorder.stopRecording()
      } catch (error) {
        console.error('❌ Error stopping audio recorder:', error)
      }
    } else {
      console.log('🎤 Starting professional voice recording')

      // Проверяем поддержку
      if (!audioRecorder.isSupported) {
        setVoiceError('❌ MediaRecorder не поддерживается в этом браузере')
        return
      }

      try {
        setVoiceError('')
        await audioRecorder.startRecording()
      } catch (error) {
        console.error('❌ Failed to start professional audio recorder:', error)
        setVoiceError('❌ Не удалось начать запись. Проверьте микрофон и разрешения.')
      }
    }
  }

  // Определяем, что делать при клике на основную кнопку
  const handleMainButtonClick = () => {
    if (message.trim()) {
      // Если есть текст - отправляем сообщение
      onSendMessage()
    } else {
      // Если нет текста - показываем подсказку использовать голосовой ввод
      // handleVoiceToggle() // Убрано - теперь отдельная кнопка
    }
  }

  // Определяем иконку и текст для основной кнопки
  const getMainButtonProps = () => {
    if (message.trim()) {
      // Режим отправки сообщения
      return {
        icon: <Send className="h-4 w-4" />,
        title: "Отправить сообщение",
        disabled: isLoading || disabled
      }
    } else {
      // Режим отправки (голосовой ввод через отдельную кнопку)
      return {
        icon: <Send className="h-4 w-4" />,
        title: "Напишите сообщение или используйте голосовой ввод",
        disabled: isLoading || disabled
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

      {/* Voice Recording Indicator */}
      {isVoiceRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Идет запись голоса...</span>
        </div>
      )}

                  {/* Professional Voice System Indicator */}
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg text-xs">
                    <span className="text-blue-600">🎙️ Профессиональная система: MediaRecorder + OpenAI Whisper</span>
                  </div>

                  {/* Voice Status/Error Indicator */}
                  {(voiceError || isVoiceRecording || isProcessingAudio) && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-lg ${
                      isVoiceRecording || isProcessingAudio
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-orange-600 bg-orange-50'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isVoiceRecording || isProcessingAudio ? 'bg-blue-500 animate-pulse' : 'bg-orange-500'
                      }`}></div>
                      <span className="flex-1">
                        {isProcessingAudio
                          ? '🎵 Обрабатываем аудио...'
                          : voiceError || '🎤 Запись активна...'
                        }
                      </span>
                      {!isVoiceRecording && !isProcessingAudio && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setVoiceError('')
                              handleVoiceToggle()
                            }}
                            className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                          >
                            Повторить
                          </button>
                          <button
                            onClick={() => setVoiceError('')}
                            className="px-2 py-1 text-xs text-orange-600 hover:text-orange-800"
                          >
                            ✕
                          </button>
                        </div>
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

          {/* Отдельная кнопка голосового ввода */}
          <Button
            size="icon"
            onClick={handleVoiceToggle}
            disabled={isLoading || disabled}
            className={`shadow-elegant ${isVoiceRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : ''}`}
            title={isVoiceRecording ? "Остановить запись" : "Голосовой ввод"}
          >
            <Mic className="h-4 w-4" />
          </Button>

          <Input
            placeholder={
              isVoiceRecording
                ? "🎤 Говорите сейчас... У вас есть 15 секунд на речь"
                : "Напишите ваш вопрос или используйте голосовой ввод..."
            }
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className={`flex-1 ${isVoiceRecording ? 'bg-red-50 border-red-300 placeholder-red-600' : ''}`}
          disabled={isLoading || disabled}
            onKeyDown={handleKeyDown}
          />

          <Button
            size="icon"
            className={`shadow-elegant ${isVoiceRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : ''}`}
            onClick={handleMainButtonClick}
            disabled={mainButtonProps.disabled}
            title={mainButtonProps.title}
          >
            {mainButtonProps.icon}
        </Button>
        </div>
    </div>
  )
}