import { useState, useRef, useEffect, useCallback } from 'react'
import { VOICE_CONFIG, SPEECH_CONFIG, BEEP_CONFIG } from '@/config/constants'

interface UseVoiceOptions {
  onTranscript?: (transcript: string) => void
  onInterimTranscript?: (transcript: string) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
  onSpeakingStart?: () => void
  onSpeakingEnd?: () => void
}

export const useVoice = (options: UseVoiceOptions = {}) => {
  const { onTranscript, onInterimTranscript, onError, onStart, onEnd, onSpeakingStart, onSpeakingEnd } = options

  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionEndedRef = useRef(false)

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
        console.log('Speech recognition started successfully')
        setIsListening(true)
        sessionEndedRef.current = false
        onStart?.()
        startBeepInterval()
      }

      recognition.onspeechstart = () => {
        console.log('Speech detected! User started speaking')
        // Пользователь начал говорить - отлично!
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
        console.log('Recognition result received:', event.results.length, 'results')
        let finalTranscript = ''
        let interimTranscript = ''

        // Собираем все результаты
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          console.log(`Result ${i}: "${transcript}", isFinal: ${event.results[i].isFinal}`)
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        // Отправляем промежуточные результаты в реальном времени
        if (interimTranscript) {
          console.log('Interim transcript:', interimTranscript)
          onInterimTranscript?.(interimTranscript)
        }

        // Используем финальный результат, если он есть, иначе промежуточный
        const currentTranscript = finalTranscript || interimTranscript
        console.log('Current transcript:', currentTranscript)
        if (currentTranscript) {
          setTranscript(currentTranscript)
          onTranscript?.(currentTranscript)
        }
      }

      recognition.onerror = (event) => {
        console.log('Speech recognition event:', event.error, event)
        setIsListening(false)
        stopBeepInterval()

        // Обрабатываем разные типы ошибок
        if (event.error === 'aborted') {
          console.log('Speech recognition was aborted (normal behavior)')
          // Для aborted не показываем ошибку пользователю
        } else if (event.error === 'no-speech') {
          console.log('No speech detected - user needs to start speaking immediately')
          // Для no-speech тоже не показываем ошибку, но это сигнал что нужно говорить сразу
        } else if (event.error === 'audio-capture') {
          console.error('Audio capture error - microphone issue')
          onError?.('Ошибка захвата звука. Проверьте микрофон.')
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

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition session')
        // Сбрасываем предыдущее состояние
        try {
          recognitionRef.current.abort()
        } catch (e) {
          // Игнорируем ошибку если не было активной сессии
        }
        
        // Запускаем новую сессию
        recognitionRef.current.start()
      } catch (error: any) {
        console.error('Error starting speech recognition:', error)
        if (error.message && error.message.includes('already started')) {
          console.log('Recognition already started, aborting and restarting...')
          recognitionRef.current?.abort()
          setTimeout(() => {
            try {
              recognitionRef.current?.start()
            } catch (e) {
              console.error('Failed to restart:', e)
              onError?.('Не удалось начать распознавание речи')
            }
          }, 100)
        } else {
        onError?.('Не удалось начать распознавание речи')
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
    }
  }, [isListening])

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
