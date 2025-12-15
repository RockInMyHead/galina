import { useState, useRef, useEffect, useCallback } from 'react'
import { VOICE_CONFIG, SPEECH_CONFIG, BEEP_CONFIG } from '@/config/constants'
import { transcribeAudioWithWhisper } from '@/utils/apiUtils'

interface UseVoiceOptions {
  onTranscript?: (transcript: string) => void
  onInterimTranscript?: (transcript: string) => void
  onError?: (error: string) => void
  onInfo?: (message: string) => void // Информационные сообщения
  onStart?: () => void
  onEnd?: () => void
  onSpeakingStart?: () => void
  onSpeakingEnd?: () => void
  useWhisperFallback?: boolean // Включить fallback через OpenAI Whisper
  silenceTimeout?: number // Таймер молчания в ms (по умолчанию 3000)
}

export const useVoice = (options: UseVoiceOptions = {}) => {
  const { onTranscript, onInterimTranscript, onError, onInfo, onStart, onEnd, onSpeakingStart, onSpeakingEnd, useWhisperFallback = true, silenceTimeout = 3000 } = options

  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionEndedRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastResultTimeRef = useRef<number>(0)

  // Для fallback через OpenAI Whisper
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isUsingFallbackRef = useRef(false)

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      const recognition = recognitionRef.current

      recognition.continuous = VOICE_CONFIG.CONTINUOUS
      recognition.interimResults = VOICE_CONFIG.INTERIM_RESULTS
      recognition.lang = VOICE_CONFIG.LANG
      recognition.maxAlternatives = VOICE_CONFIG.MAX_ALTERNATIVES
      
      // Важные настройки для стабильности
      try {
        // @ts-ignore - WebKit specific properties
        if (recognition.speechRecognitionList) {
          recognition.speechRecognitionList = null;
        }
      } catch (e) {
        console.log('Could not set WebKit specific properties');
      }

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started successfully')
        setIsListening(true)
        sessionEndedRef.current = false
        lastResultTimeRef.current = Date.now()
        onStart?.()
        startBeepInterval()
        resetSilenceTimeout() // Запускаем таймер молчания
        onInfo?.('🎤 Микрофон активен! Говорите сейчас...')
      }

      recognition.onspeechstart = () => {
        console.log('🎤 Speech detected! User started speaking')
        resetSilenceTimeout() // Сбрасываем таймер молчания при начале речи
      }

      recognition.onspeechend = () => {
        console.log('Speech ended - user stopped speaking')
      }

      recognition.onaudiostart = () => {
        console.log('Audio capture started')
      }

      recognition.onaudioend = () => {
        console.log('Audio capture ended')
      }

      recognition.onsoundstart = () => {
        console.log('Sound detected')
      }

      recognition.onsoundend = () => {
        console.log('Sound ended')
      }

      recognition.onresult = (event) => {
        console.log('🎤 Recognition result received:', event.results.length, 'results')
        console.log('🎤 Result index:', event.resultIndex)
        let finalTranscript = ''
        let interimTranscript = ''

        // Собираем все результаты
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript
          const confidence = result[0].confidence

          console.log(`🎤 Result ${i}: "${transcript}", isFinal: ${result.isFinal}, confidence: ${confidence}`)

          if (result.isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        // Отправляем промежуточные результаты в реальном времени
        if (interimTranscript) {
          console.log('🎤 Interim transcript:', interimTranscript)
          onInterimTranscript?.(interimTranscript)
          setTranscript(interimTranscript)
        }

        // Если есть финальный результат, используем его
        if (finalTranscript.trim()) {
          console.log('✅ Final transcript received:', finalTranscript)
          setTranscript(finalTranscript.trim())
          onTranscript?.(finalTranscript.trim())

          // Для continuous: false перезапускаем распознавание
          setTimeout(() => {
            if (isListening && recognitionRef.current && !sessionEndedRef.current) {
              try {
                console.log('🔄 Restarting recognition after final result')
                recognitionRef.current.start()
              } catch (error) {
                console.error('❌ Failed to restart recognition:', error)
              }
            }
          }, 1000)
        }

        // Сбрасываем таймер молчания при любом результате
        resetSilenceTimeout()
      }

      recognition.onerror = async (event) => {
        console.log('Speech recognition event:', event.error, event.message)
        setIsListening(false)
        stopBeepInterval()
        clearSilenceTimeout() // Очищаем таймер молчания

        // Обрабатываем разные типы ошибок
        if (event.error === 'aborted') {
          console.log('Speech recognition was aborted (normal behavior)')
          // Для aborted не показываем ошибку пользователю
        } else if (event.error === 'no-speech') {
          console.log('🎤 No speech detected - trying Whisper fallback if enabled')

          // Если включен fallback через Whisper, пробуем записать аудио
          if (useWhisperFallback && !isUsingFallbackRef.current) {
            const hasApiKey = import.meta.env.VITE_OPENAI_API_KEY && import.meta.env.VITE_OPENAI_API_KEY.length > 10
            if (!hasApiKey) {
              console.log('❌ OpenAI API key not found, skipping Whisper fallback')
              onError?.('API ключ OpenAI не найден. Резервное распознавание недоступно.')
              return
            }

            console.log('🎵 Switching to Whisper fallback...')
            onInfo?.('🎤 Резервное распознавание: говорите четко в микрофон 5 секунд...')
            isUsingFallbackRef.current = true
            await startWhisperFallback()
          } else {
            // Показываем подсказку пользователю
            onError?.('❌ Речь не обнаружена. Возможные причины:\n• Говорите громче и ближе к микрофону\n• Проверьте, что микрофон не отключен\n• Попробуйте другой браузер (Chrome)\n• Обновите страницу')
          }
        } else if (event.error === 'audio-capture') {
          console.error('Audio capture error - microphone issue')
          onError?.('Ошибка захвата звука. Проверьте доступ к микрофону в настройках браузера.')
        } else if (event.error === 'not-allowed') {
          console.error('Microphone access denied')
          onError?.('Доступ к микрофону заблокирован. Разрешите доступ в настройках браузера.')
        } else if (event.error === 'network') {
          console.error('Network error during speech recognition')
          onError?.('Ошибка сети при распознавании речи.')
        } else {
          console.error('Speech recognition error:', event.error)
          onError?.(`Ошибка распознавания речи: ${event.error}`)
        }

        if (!sessionEndedRef.current) {
          sessionEndedRef.current = true
          onEnd?.()
        }
      }

      recognition.onend = () => {
        console.log('Speech recognition ended normally')
        setIsListening(false)
        stopBeepInterval()
        clearSilenceTimeout() // Очищаем таймер молчания

        if (!sessionEndedRef.current) {
          sessionEndedRef.current = true
          onEnd?.()
        }
      }
    }

    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      stopBeepInterval()
      clearSilenceTimeout()
    }
  }, [onTranscript, onError, onStart, onEnd])

  // Play beep sound
  const playBeep = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = BEEP_CONFIG.FREQUENCY
    oscillator.type = BEEP_CONFIG.TYPE

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + BEEP_CONFIG.DURATION)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + BEEP_CONFIG.DURATION)
  }, [])

  // Start beep interval
  const startBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current)
    }
    beepIntervalRef.current = setInterval(playBeep, BEEP_CONFIG.INTERVAL)
  }, [playBeep])

  // Stop beep interval
  const stopBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current)
      beepIntervalRef.current = null
    }
  }, [])

  // Reset silence timeout
  const resetSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }
    silenceTimeoutRef.current = setTimeout(() => {
      console.log(`Silence timeout reached (${silenceTimeout}ms), stopping recognition`)
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop()
      }
    }, silenceTimeout)
  }, [isListening, silenceTimeout])

  // Clear silence timeout
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  }, [])

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('🎤 Starting speech recognition session')
        recognitionRef.current.start()
      } catch (error: any) {
        console.error('❌ Error starting speech recognition:', error)
        if (error.message && error.message.includes('not-allowed')) {
          onError?.('Доступ к микрофону заблокирован. Разрешите доступ в настройках браузера.')
        } else if (error.message && error.message.includes('already started')) {
          console.log('Recognition already started, ignoring')
        } else {
          onError?.('Не удалось начать распознавание речи. Попробуйте обновить страницу.')
        }
      }
    } else {
      console.log('Speech recognition already active or not available')
    }
  }, [isListening, onError])

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      clearSilenceTimeout() // Очищаем таймер молчания
    }

    // Также останавливаем MediaRecorder если он работает
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🎵 Stopping MediaRecorder...')
      mediaRecorderRef.current.stop()
    }

    isUsingFallbackRef.current = false
  }, [isListening])

  // Fallback транскрибация через OpenAI Whisper
  const startWhisperFallback = useCallback(async () => {
    try {
      console.log('🎵 Starting Whisper fallback recording...')
      onStart?.() // Уведомляем о начале записи

      // Запрашиваем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      // Создаем MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🎵 Audio recording stopped, sending to Whisper...')

        // Закрываем поток
        stream.getTracks().forEach(track => track.stop())

        // Создаем Blob из chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('🎵 Audio blob created:', audioBlob.size, 'bytes')

        try {
          // Отправляем в OpenAI Whisper
          const transcription = await transcribeAudioWithWhisper(audioBlob)

          if (transcription && transcription.trim()) {
            console.log('✅ Whisper fallback successful:', transcription)
            setTranscript(transcription.trim())
            onTranscript?.(transcription.trim())
          } else {
            console.log('⚠️ Whisper returned empty transcription')
            onError?.('Не удалось распознать речь. Попробуйте говорить четче.')
          }
        } catch (whisperError) {
          console.error('❌ Whisper fallback failed:', whisperError)
          onError?.('Ошибка распознавания речи. Попробуйте еще раз.')
        } finally {
          isUsingFallbackRef.current = false
          setIsListening(false)
          onEnd?.()
        }
      }

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error)
        onError?.('Ошибка записи аудио.')
        isUsingFallbackRef.current = false
        setIsListening(false)
        onEnd?.()
      }

      // Начинаем запись
      mediaRecorder.start()
      console.log('🎵 Whisper fallback recording started for 5 seconds')
      setIsListening(true) // Обновляем состояние

      // Автоматически останавливаем через 5 секунд
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('🎵 Auto-stopping Whisper recording after 5 seconds')
          mediaRecorder.stop()
        }
      }, 5000)

    } catch (error) {
      console.error('❌ Failed to start Whisper fallback:', error)
      onError?.('Не удалось начать запись аудио для распознавания.')
      isUsingFallbackRef.current = false
      setIsListening(false)
      onEnd?.()
    }
  }, [onTranscript, onError, onEnd])

  // Speak text
  const speak = useCallback((text: string) => {
    if (synthRef.current) {
      setIsSpeaking(true)
      onSpeakingStart?.()

      // Cancel previous speech
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = SPEECH_CONFIG.LANG
      utterance.rate = SPEECH_CONFIG.RATE
      utterance.pitch = SPEECH_CONFIG.PITCH
      utterance.volume = SPEECH_CONFIG.VOLUME

      utterance.onend = () => {
        setIsSpeaking(false)
        onSpeakingEnd?.()
      }

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event)
        setIsSpeaking(false)
        onSpeakingEnd?.()
        onError?.('Ошибка синтеза речи')
      }

      synthRef.current.speak(utterance)
    }
  }, [onError, onSpeakingStart, onSpeakingEnd])

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
      onSpeakingEnd?.()
    }
  }, [onSpeakingEnd])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    isSpeaking,
    transcript,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript,
  }
}
