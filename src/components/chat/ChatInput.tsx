import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Upload, X, FileText, Image } from 'lucide-react'
import { FilePreview } from '@/types'
import { formatFileSize } from '@/utils/fileUtils'

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
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

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
              {file.type.startsWith('image/') ? (
                <Image className="h-4 w-4" />
                ) : (
                <FileText className="h-4 w-4" />
                )}
              <span className="truncate max-w-32">{file.name}</span>
              <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
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
          disabled={isLoading || disabled}
            onKeyDown={handleKeyDown}
          />

          <Button
            size="icon"
          className="shadow-elegant"
          onClick={onSendMessage}
          disabled={isLoading || disabled || (!message.trim() && selectedFiles.length === 0)}
          title="Отправить сообщение"
        >
            <Send className="h-4 w-4" />
        </Button>
        </div>
    </div>
  )
}