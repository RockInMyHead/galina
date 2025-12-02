import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff, Square, Bug, X, Volume2, VolumeX } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AssistantOrb from "@/components/AssistantOrb";

// Hooks
import { useLawyerTTS } from "@/hooks/lawyer-voice/useLawyerTTS";
import { useLawyerLLM } from "@/hooks/lawyer-voice/useLawyerLLM";
import { useLawyerTranscription } from "@/hooks/lawyer-voice/useLawyerTranscription";

// Debug Logs Component
const DebugLogs = ({ logs, isVisible, onToggle, onClear }: {
  logs: string[];
  isVisible: boolean;
  onToggle: () => void;
  onClear: () => void;
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-black/90 text-green-400 font-mono text-xs rounded-lg border border-gray-600 overflow-hidden z-50">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-600">
        <span className="flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Debug Logs
        </span>
        <div className="flex gap-1">
          <Button
            onClick={onClear}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-gray-400 hover:text-white"
          >
            Clear
          </Button>
          <Button
            onClick={onToggle}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="p-2 max-h-80 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">No logs yet...</div>
        ) : (
          logs.slice(-50).map((log, index) => (
            <div key={index} className="mb-1 leading-tight">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Function to detect Safari
const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

const VoiceLawyer = () => {
  const { token: authToken } = useAuth();
  const token = authToken || localStorage.getItem('galina-token');
  const navigate = useNavigate();
  const { toast } = useToast();

  // UI State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInitializingCall, setIsInitializingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Debug Logs State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Audio/Video State
  const [isMuted, setIsMuted] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const callTimerRef = useRef<number | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  // Debug logging functions
  const addDebugLog = useCallback((message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev, message]);
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const toggleDebugLogs = useCallback(() => {
    setShowDebugLogs(prev => !prev);
  }, []);

  // --- Hooks Initialization ---

  // 1. TTS Service (Speech Synthesis)
  const {
    speak,
    stop: stopTTS,
    resetDeduplication,
    isPlaying: isTTSPlaying,
    isSynthesizing: isTTSSynthesizing,
    isPlayingRef: isTTSPlayingRef,
    isSynthesizingRef: isTTSSynthesizingRef
  } = useLawyerTTS({
    token,
    onPlaybackStatusChange: (isActive) => {
      if (!isActive) {
        console.log('[TTS] TTS session ended, ready for new text');
      }
    }
  });

  // Combined ref for "Is Assistant Speaking"
  const isAssistantSpeakingRef = useRef(false);

  useEffect(() => {
    isAssistantSpeakingRef.current = isTTSPlaying || isTTSSynthesizing;
  }, [isTTSPlaying, isTTSSynthesizing]);

  // 2. LLM Service (Logic)
  const {
    processUserMessage,
    loadUserProfile,
    addToConversation,
    isProcessing: isAIProcessing
  } = useLawyerLLM({
    userId: undefined,
    callId: currentCallId,
    token,
    onResponseGenerated: async (text) => {
      if (isSoundEnabled) {
        await speak(text);
      }
    },
    onError: (err) => setError(err)
  });

  // 3. Transcription Service (Speech Recognition)
  const {
    initializeRecognition,
    cleanup: cleanupRecognition,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    forceOpenAI,
    isIOS,
    stopRecognition,
    startRecognition
  } = useLawyerTranscription({
    token,
    isTTSActiveRef: isAssistantSpeakingRef,
    addDebugLog,
    onTranscriptionComplete: async (text, source) => {
      const transcribeId = Date.now();
      console.log(`[VoiceLawyer] onTranscriptionComplete (ID: ${transcribeId}) called with: "${text}" from ${source}`);
      if (!text) return;

      // Stop TTS if user interrupted
      if (source !== 'manual') stopTTS();

      // Reset TTS deduplication for new user input
      resetDeduplication();

      console.log(`[VoiceLawyer] About to call processUserMessage (ID: ${transcribeId})`);
      await processUserMessage(text);
      console.log(`[VoiceLawyer] processUserMessage completed (ID: ${transcribeId})`);
    },
    onInterruption: () => {
      stopTTS();
    },
    onSpeechStart: () => {
      // Optional: UI indication
    },
    onError: (err) => {
      setError(err);
      toast({
        title: "Ошибка",
        description: err,
        variant: "destructive"
      });
    }
  });

  // --- Lifecycle & Logic ---

  const startCall = async () => {
    if (isCallActive) return;
    setIsInitializingCall(true);
    setError(null);

    try {
      // Create Call Session ID
      const callId = `call_${Date.now()}`;
      setCurrentCallId(callId);

      // Load User Profile
      await loadUserProfile();

      // Initialize Audio/Recognition
      await initializeRecognition();

      // UI Updates
      setIsCallActive(true);
      setCallDuration(0);

      // Initial Greeting
      setTimeout(async () => {
        const greeting = "Здравствуйте! Я Галина, ваш юридический консультант. Чем могу помочь?";
        addToConversation('assistant', greeting);
        if (isSoundEnabled) {
          await speak(greeting);
        }
      }, 1000);

      // Start Timer
      callTimerRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Start call error:", err);
      setError(err.message || "Не удалось начать звонок");
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось начать звонок",
        variant: "destructive"
      });
      cleanupRecognition();
      setCurrentCallId(null);
    } finally {
      setIsInitializingCall(false);
    }
  };

  const endCall = async () => {
    stopTTS();
    cleanupRecognition();

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    setIsCallActive(false);
    setCallDuration(0);
    setCurrentCallId(null);
    setError(null);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startRecognition();
    } else {
      setIsMuted(true);
      stopRecognition();
    }
  };

  const toggleSound = () => {
    setIsSoundEnabled(prev => !prev);
    if (isSoundEnabled) {
      stopTTS();
    }
    toast({
      title: isSoundEnabled ? "Звук отключен" : "Звук включен",
      description: isSoundEnabled ? "Ответы не будут озвучиваться" : "Ответы будут озвучиваться"
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      cleanupRecognition();
      stopTTS();
    };
  }, []);

  // Determine Orb state
  const orbState = useMemo(() => {
    if (isTTSPlaying || isTTSSynthesizing) return 'speaking';
    if (isAIProcessing) return 'processing';
    if (isCallActive && !isMuted) return 'listening';
    return 'idle';
  }, [isTTSPlaying, isTTSSynthesizing, isAIProcessing, isCallActive, isMuted]);

  // Determine status text
  const statusText = useMemo(() => {
    if (isTTSPlaying || isTTSSynthesizing) return 'Говорю...';
    if (isAIProcessing) return 'Думаю...';
    if (isCallActive && !isMuted) return 'Слушаю...';
    if (isCallActive && isMuted) return 'Микрофон отключен';
    return 'Нажмите на микрофон, чтобы начать';
  }, [isTTSPlaying, isTTSSynthesizing, isAIProcessing, isCallActive, isMuted]);

  // Show interrupt button for non-Safari browsers during TTS
  const showInterruptButton = (isTTSPlaying || isTTSSynthesizing) && !isSafari();

  // --- Render ---

  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col font-sans">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 pt-16 pb-32 md:pb-24">

        {/* Title */}
        <div className="text-center mb-6 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Юридическая консультация
          </h1>
          <p className="text-muted-foreground">
            Голосовой помощник Галина
          </p>
        </div>

        {isInitializingCall ? (
          <div className="flex flex-col items-center space-y-8">
            <div className="relative flex items-center justify-center scale-90 md:scale-100">
              <AssistantOrb state="processing" />
            </div>
            <h2 className="text-2xl font-bold">Инициализация...</h2>
          </div>
        ) : !isCallActive ? (
          <div className="flex flex-col items-center space-y-8">
            {/* Assistant Orb */}
            <div className="relative flex items-center justify-center scale-90 md:scale-100 transition-transform duration-500">
              <AssistantOrb state="idle" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Начать консультацию</h2>
              <p className="text-muted-foreground">Нажмите кнопку ниже, чтобы начать</p>

              {isMobile && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">📱 Мобильное устройство обнаружено</p>
                  {isIOS && <p className="text-xs text-blue-600 mt-1">Оптимизировано для iOS</p>}
                </div>
              )}
            </div>

            <Button
              onClick={startCall}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg text-lg px-12 py-6"
            >
              <Phone className="w-6 h-6 mr-2" />
              Позвонить
            </Button>

            {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-8">
            {/* Assistant Orb */}
            <div className="relative flex items-center justify-center scale-100 md:scale-110 transition-transform duration-500">
              <AssistantOrb state={orbState} />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Консультация идет</h2>
              <div className="text-lg font-medium text-primary">{formatDuration(callDuration)}</div>
            </div>

            {/* Status */}
            <div className="text-foreground/80 text-xl md:text-2xl font-light tracking-widest uppercase transition-colors duration-300">
              {statusText}
            </div>

            {/* Interrupt Button */}
            {showInterruptButton && (
              <Button
                variant="outline"
                size="lg"
                className="bg-green-500 hover:bg-green-600 text-white border-green-600 hover:border-green-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-300"
                onClick={() => {
                  console.log('🛑 User clicked interrupt button');
                  stopTTS();
                }}
              >
                <span className="font-medium">Прервать</span>
              </Button>
            )}

            {/* Debug Logs Toggle */}
            <div className="mt-4 flex justify-center">
              <Button
                onClick={toggleDebugLogs}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 text-xs"
              >
                <Bug className="w-3 h-3" />
                {showDebugLogs ? 'Скрыть логи' : 'Показать логи'}
              </Button>
            </div>

            {/* Mobile/No-Mic Text Fallback */}
            {!microphoneAccessGranted && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium mb-3 text-red-800">
                  🚫 Проблема с микрофоном
                </h3>
                <p className="text-sm text-red-600 mb-3">
                  {forceOpenAI ?
                    "Используется текстовый режим (OpenAI)" :
                    "Микрофон недоступен. Проверьте разрешения."}
                </p>
                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <div>📱 Устройство: iOS={isIOS ? 'Да' : 'Нет'} | Мобильный={isMobile ? 'Да' : 'Нет'}</div>
                  <div>🎯 Режим: OpenAI={forceOpenAI ? 'Включен' : 'Отключен'}</div>
                  <div>🔐 Разрешения: {microphonePermissionStatus}</div>
                </div>
                {forceOpenAI && (
                  <Button
                    onClick={() => {
                      const msg = prompt("Сообщение:");
                      if (msg) processUserMessage(msg);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Отправить сообщение
                  </Button>
                )}
              </div>
            )}

            {transcriptionStatus && (
              <p className="text-sm text-primary/80 animate-pulse">{transcriptionStatus}</p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>

      {/* Controls */}
      {isCallActive && (
        <div className="absolute bottom-8 left-0 right-0 z-50 flex items-center justify-center space-x-6 md:space-x-12 px-4 pb-safe">
          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 border ${isSoundEnabled ? 'bg-background border-border text-foreground hover:bg-accent' : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20'}`}
            onClick={toggleSound}
          >
            {isSoundEnabled ? <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> : <VolumeX className="w-5 h-5 md:w-6 md:h-6" />}
          </Button>

          {/* Mic Toggle (Main Action) */}
          <Button
            variant="default"
            size="icon"
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg transition-all duration-500 transform hover:scale-105 ${isMuted
              ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 md:w-8 md:h-8" />
            ) : (
              <Mic className="w-6 h-6 md:w-8 md:h-8" />
            )}
          </Button>

          {/* End Call */}
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:text-destructive transition-all duration-300"
            onClick={endCall}
          >
            <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>
      )}

      {/* Debug Logs Panel */}
      <DebugLogs
        logs={debugLogs}
        isVisible={showDebugLogs}
        onToggle={toggleDebugLogs}
        onClear={clearDebugLogs}
      />
    </div>
  );
};

export default VoiceLawyer;


