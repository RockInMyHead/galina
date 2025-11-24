import { Card, CardContent } from '@/components/ui/card'

interface VoiceStatusProps {
  isListening: boolean
  isVoiceMode: boolean
  isSpeaking: boolean
  isContinuousListening?: boolean
  interimTranscript?: string
}

export const VoiceStatus = ({
  isListening,
  isVoiceMode,
  isSpeaking,
  isContinuousListening,
  interimTranscript
}: VoiceStatusProps) => {
  if (!isListening && !isVoiceMode && !isSpeaking && !isContinuousListening) return null

  return (
    <Card className="border-border/50 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {isContinuousListening && (
            <>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-600 font-medium">🎤 Непрерывное прослушивание активно</span>
            </>
          )}
          {isListening && !isContinuousListening && (
            <>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-600 font-medium">🎤 Галина вас слушает...</span>
            </>
          )}
          {isVoiceMode && (
            <>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#129246' }}></div>
              <span className="font-medium" style={{ color: '#129246' }}>✅ Готова к ответу</span>
            </>
          )}
          {isSpeaking && (
            <>
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-purple-600 font-medium">🔊 Галина говорит...</span>
            </>
          )}
        </div>
        {isContinuousListening && interimTranscript && (
          <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
            <p className="text-sm text-blue-700">
              <strong>Вы говорите:</strong> "{interimTranscript}"
            </p>
          </div>
        )}
        {isListening && !isContinuousListening && (
          <p className="text-sm text-muted-foreground mt-2">
            Говорите ваш вопрос четко и разборчиво.
          </p>
        )}
        {isContinuousListening && (
          <p className="text-sm text-muted-foreground mt-2">
            Режим непрерывного прослушивания: говорите естественно, система автоматически распознает паузы.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
