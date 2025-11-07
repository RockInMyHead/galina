import { Card, CardContent } from '@/components/ui/card'

interface VoiceStatusProps {
  isListening: boolean
  isVoiceMode: boolean
  isSpeaking: boolean
}

export const VoiceStatus = ({ isListening, isVoiceMode, isSpeaking }: VoiceStatusProps) => {
  if (!isListening && !isVoiceMode && !isSpeaking) return null

  return (
    <Card className="border-border/50 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {isListening && (
            <>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-600 font-medium">🎤 Галина вас слушает...</span>
            </>
          )}
          {isVoiceMode && (
            <>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-600 font-medium">✅ Готова к ответу</span>
            </>
          )}
          {isSpeaking && (
            <>
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-purple-600 font-medium">🔊 Галина говорит...</span>
            </>
          )}
        </div>
        {isListening && (
          <p className="text-sm text-muted-foreground mt-2">
            Говорите ваш вопрос четко и разборчиво. Скажите "Завершить" для окончания записи.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
