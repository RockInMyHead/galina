import { useState, useRef, useCallback, useEffect } from 'react'

interface UseAudioRecorderOptions {
  onRecordingStart?: () => void
  onRecordingStop?: (blob: Blob | null) => void
  onError?: (error: string) => void
}

export const useAudioRecorder = (options: UseAudioRecorderOptions = {}) => {
  const { onRecordingStart, onRecordingStop, onError } = options

  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [mimeType, setMimeType] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Проверка поддержки MediaRecorder
  const isSupported = typeof MediaRecorder !== 'undefined'

  // Выбор лучшего MIME типа
  const getBestMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return '' // Браузер выберет по умолчанию
  }, [])

  // Запрос разрешения на использование микрофона
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AudioRecorder] Requesting microphone permission...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
          autoGainControl: true,
          latency: 0.01,
        }
      })

      // Закрываем тестовый поток
      stream.getTracks().forEach(track => track.stop())

      setHasPermission(true)
      console.log('[AudioRecorder] Microphone permission granted')
      return true
    } catch (error) {
      console.error('[AudioRecorder] Microphone permission denied:', error)
      setHasPermission(false)
      onError?.('Доступ к микрофону запрещен')
      return false
    }
  }, [onError])

  // Проверка текущего состояния разрешения
  const checkPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setHasPermission(result.state === 'granted')
    } catch (error) {
      // Fallback для браузеров без permissions API
      setHasPermission(null)
    }
  }, [])

  // Инициализация при монтировании
  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  // Запуск записи
  const startRecording = useCallback(async () => {
    console.log('[AudioRecorder] Starting recording...')

    if (!isSupported) {
      throw new Error('MediaRecorder не поддерживается в этом браузере')
    }

    if (!hasPermission) {
      console.log('[AudioRecorder] No permission, requesting...')
      const granted = await requestPermission()
      if (!granted) {
        throw new Error('Доступ к микрофону запрещен')
      }
    }

    console.log('[AudioRecorder] Getting user media stream...')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        channelCount: 1,
        autoGainControl: true,
        latency: 0.01,
      }
    })

    console.log('[AudioRecorder] Stream obtained, active:', stream.active)
    streamRef.current = stream
    chunksRef.current = []

    const selectedMimeType = getBestMimeType()
    setMimeType(selectedMimeType)
    console.log('[AudioRecorder] Selected mime type:', selectedMimeType)

    const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined
    console.log('[AudioRecorder] Creating MediaRecorder with options:', options)

    const mediaRecorder = new MediaRecorder(stream, options)
    console.log('[AudioRecorder] MediaRecorder created, state:', mediaRecorder.state)

    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    })

    mediaRecorder.addEventListener('start', () => {
      console.log('[AudioRecorder] Recording started')
      setIsRecording(true)
      onRecordingStart?.()
    })

    mediaRecorder.addEventListener('stop', () => {
      console.log('[AudioRecorder] Recording stopped')
      setIsRecording(false)
    })

    mediaRecorder.addEventListener('error', (event) => {
      console.error('[AudioRecorder] Recording error:', event)
      setIsRecording(false)
      onError?.('Ошибка записи аудио')
    })

    mediaRecorder.start()
    console.log('[AudioRecorder] Recording initiated')
  }, [isSupported, hasPermission, requestPermission, getBestMimeType, onRecordingStart, onError])

  // Остановка записи и получение Blob
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.log('[AudioRecorder] No active recording to stop')
      return null
    }

    return new Promise((resolve) => {
      mediaRecorder.addEventListener(
        'stop',
        () => {
          console.log('[AudioRecorder] Processing recorded chunks...')

          // Используем реальный MIME тип или выбранный
          const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: finalMimeType })

          console.log(`[AudioRecorder] Created blob: ${blob.size} bytes, type: ${blob.type}`)

          // Останавливаем все треки
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }

          // Очищаем ресурсы
          mediaRecorderRef.current = null
          chunksRef.current = []

          onRecordingStop?.(blob)
          resolve(blob)
        },
        { once: true }
      )

      console.log('[AudioRecorder] Stopping MediaRecorder...')
      mediaRecorder.stop()
    })
  }, [mimeType, onRecordingStop])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
    isSupported
  }
}
