import { ChatMessage as ChatMessageType, FilePreview } from '@/types'
import { Sparkles, User, FileText, Image, Download, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface ChatMessageProps {
  message: ChatMessageType
  isLast?: boolean
}

export const ChatMessage = ({ message, isLast }: ChatMessageProps) => {
  const isAssistant = message.role === 'assistant'

  // Функция генерации PDF из сообщения
  const generatePDF = async () => {
    try {
      // Создаем временный элемент для конвертации в PDF
      const element = document.createElement('div')
      element.innerHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Консультация AI-юриста Галины
          </h2>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            Дата: ${message.timestamp.toLocaleDateString('ru-RU')} в ${message.timestamp.toLocaleTimeString('ru-RU')}
          </p>
          <div style="line-height: 1.6; color: #374151;">
            ${message.content
              .replace(/\n/g, '<br>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/```([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:10px;border-radius:4px;margin:10px 0;">$1</pre>')
              .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 4px;border-radius:3px;">$1</code>')
            }
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>Сгенерировано AI-юристом Галиной</p>
            <p>www.galina-ai.ru</p>
          </div>
        </div>
      `

      // Стилизуем элемент
      element.style.position = 'absolute'
      element.style.left = '-9999px'
      element.style.top = '-9999px'
      document.body.appendChild(element)

      // Конвертируем в canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      // Удаляем временный элемент
      document.body.removeChild(element)

      // Создаем PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      // Вычисляем размеры для A4
      const imgWidth = 210 // A4 ширина в мм
      const pageHeight = 295 // A4 высота в мм
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      // Добавляем первую страницу
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Добавляем дополнительные страницы если нужно
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Скачиваем PDF
      const fileName = `galina_consultation_${message.timestamp.toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)

    } catch (error) {
      console.error('Ошибка генерации PDF:', error)
      alert('Не удалось сгенерировать PDF. Попробуйте еще раз.')
    }
  }


  return (
    <div className={`flex items-start gap-3 ${isAssistant ? '' : 'justify-end'}`}>
      {isAssistant && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div className={`flex-1 ${isAssistant ? '' : 'max-w-[70%]'}`}>
        <div className={`rounded-lg p-4 ${
          isAssistant
            ? 'bg-muted'
            : 'bg-primary text-white ml-auto'
        }`}>
          {/* File attachments */}
          {message.files && Array.isArray(message.files) && message.files.length > 0 && (
            <div className="mb-3 space-y-2">
              {message.files
                .filter(file => file != null) // Filter out null/undefined files
                .map((file, index) => (
                <div key={index} className={`flex items-center gap-2 p-2 rounded-lg ${
                  isAssistant ? 'bg-black/10' : 'bg-white/20'
                }`}>
                    {file && file.type && typeof file.type === 'string' && file.type.startsWith('image/') ? (
                    <Image className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className={`text-xs truncate ${isAssistant ? '' : 'text-white'}`}>
                      {file?.name || 'Неизвестный файл'}
                  </span>
                  <span className={`text-xs ${isAssistant ? 'opacity-70' : 'text-white/70'}`}>
                      ({file?.size ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : 'размер неизвестен'})
                  </span>
                </div>
                ))}
            </div>
          )}

          {/* Uploaded file attachment */}
          {message.uploadedFile && (
            <div className="mb-3">
              <div className={`flex items-center gap-2 p-2 rounded-lg ${
                isAssistant ? 'bg-black/10' : 'bg-white/20'
              }`}>
                {message.uploadedFile.type && message.uploadedFile.type.startsWith('image/') ? (
                  <Image className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 flex-shrink-0" />
                )}
                <span className={`text-xs truncate ${isAssistant ? '' : 'text-white'}`}>
                  {message.uploadedFile.name}
                </span>
                <span className={`text-xs ${isAssistant ? 'opacity-70' : 'text-white/70'}`}>
                  (загружено)
                </span>
                {message.uploadedFile.type.startsWith('image/') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const img = new Image();
                      img.src = message.uploadedFile!.data;
                      const newWindow = window.open();
                      newWindow?.document.write(`<img src="${message.uploadedFile!.data}" style="max-width: 100%; height: auto;" />`);
                    }}
                    className="h-6 px-2 ml-auto"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Message content */}
          <div className={`text-sm prose prose-sm max-w-none ${
            isAssistant ? '' : 'prose-invert'
          }`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Action buttons for assistant messages */}
          {isAssistant && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
              <Button
                size="sm"
                variant="outline"
                onClick={generatePDF}
                className="flex items-center gap-1 text-xs"
              >
                <FileDown className="h-3 w-3" />
                Скачать PDF
              </Button>
            </div>
          )}

          {/* Timestamp */}
          <p className={`text-xs mt-2 ${isAssistant ? 'opacity-70' : 'text-white/70'}`}>
            {message.timestamp.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {!isAssistant && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
