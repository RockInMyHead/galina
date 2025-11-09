import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { sendChatMessage } from "@/utils/apiUtils";
import { AI_SYSTEM_MESSAGES } from "@/config/constants";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const Voice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос голосом, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningText, setReasoningText] = useState('');

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsRecording(true);
        setIsContinuousListening(true);
      };

      recognition.onresult = (event) => {
        console.log('📝 Speech recognition result received');

        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          setInterimTranscript(interimTranscript);
        }

        if (finalTranscript && finalTranscript.trim()) {
          console.log('✅ Final transcript:', finalTranscript.trim());
          setTranscript(finalTranscript.trim());
          setInterimTranscript('');
          // Automatically send the message when speech recognition is complete
          console.log('🎯 Triggering handleSendMessage from speech recognition...');
          handleSendMessage(finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsRecording(false);
        setIsContinuousListening(false);
      };

      recognition.onend = () => {
        console.log('🛑 Speech recognition ended');
        setIsRecording(false);
        setIsContinuousListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // TTS function for AI responses
  const speakAIResponse = async (text: string) => {
    try {
      console.log('🎵 Preparing to speak AI response...');

      if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Speech synthesis not supported in this browser');
        return;
      }

      // Split text into sentences for natural speech
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      console.log('📝 Split into', sentences.length, 'sentences for TTS');

      // Speak each sentence sequentially
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (sentence.length === 0) continue;

        console.log(`🔊 Speaking sentence ${i + 1}/${sentences.length}: "${sentence.substring(0, 50)}..."`);
        await speakSentence(sentence);

        // Small pause between sentences
        if (i < sentences.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('✅ TTS completed for AI response');
    } catch (error) {
      console.error('❌ Error in TTS:', error);
    }
  };

  // Speak a single sentence using browser's SpeechSynthesis
  const speakSentence = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice settings
      utterance.lang = 'ru-RU'; // Russian language
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0; // Normal pitch
      utterance.volume = 0.8; // Good volume

      // Try to find a Russian voice
      const voices = speechSynthesis.getVoices();
      const russianVoice = voices.find(voice =>
        voice.lang.startsWith('ru') || voice.name.toLowerCase().includes('russian')
      );
      if (russianVoice) {
        utterance.voice = russianVoice;
        console.log('🎤 Using Russian voice:', russianVoice.name);
      }

      utterance.onstart = () => {
        console.log('▶️ TTS started for sentence');
      };

      utterance.onend = () => {
        console.log('⏹️ TTS ended for sentence');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ TTS error:', event.error);
        resolve(); // Continue even if error
      };

      speechSynthesis.speak(utterance);
    });
  };

  // Voice control functions
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        console.log('▶️ Starting continuous speech recognition');
        recognitionRef.current.start();
      } catch (error) {
        console.error('❌ Error starting speech recognition:', error);
      }
    }
  }, [isRecording]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      console.log('🛑 Stopping speech recognition');
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  // Handle audio recording completion (legacy MediaRecorder - keeping for compatibility)
  const handleAudioRecorded = async (audioBlob: Blob) => {
    // Since we now use Web Speech API, this function is mainly for legacy compatibility
    // The actual transcription happens in the Web Speech API result handler
    console.log('🎤 Legacy audio processing called, but using Web Speech API instead');
    setIsProcessingAudio(false);
  };

  // Функция для сжатия аудио (упрощенная версия)
  const compressAudio = async (audioBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Simple passthrough for now - in a real implementation you'd compress
        resolve(audioBlob);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Функция для отправки аудио на сервер для распознавания
  const transcribeAudioOnServer = async (audioBlob: Blob): Promise<string> => {
    // Since we're using Web Speech API, this is just a placeholder
    return '';
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const selectedMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        console.log('🎤 Recording stopped, processing audio...', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        handleAudioRecorded(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Собираем данные каждую секунду для лучшего контроля размера
      setIsRecording(true);

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Не удалось начать запись. Проверьте разрешения на микрофон.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('🛑 Stopping audio recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Функция отправки сообщения
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    console.log('🎯 handleSendMessage called with:', messageText);
    setIsLoading(true);
    setReasoningText('Галина думает...');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setTranscript('');

    try {
      console.log('🔄 Starting AI reasoning steps...');
      // Simulate AI reasoning steps
      const reasoningSteps = [
        'Анализирую ваш вопрос...',
        'Ищу релевантную юридическую информацию...',
        'Формирую ответ на основе законодательства...'
      ];

      for (let i = 0; i < reasoningSteps.length; i++) {
        const step = reasoningSteps[i].trim();
        if (step.length > 0) {
          setReasoningText(step);
          console.log(`📋 Step ${i + 1}:`, step);
          await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        }
      }

      console.log('🚀 Calling AI API...');
      // Call AI API
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: AI_SYSTEM_MESSAGES.voice
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 2000
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ API error:', response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      console.log('📥 API response received, parsing...');
      const data = await response.json();
      console.log('📄 Raw API response:', data);

      const aiResponse = data.choices?.[0]?.message?.content || 'Извините, произошла ошибка при обработке вашего запроса.';
      console.log('💬 AI response extracted:', aiResponse.substring(0, 100) + '...');

      // Add AI response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('✅ Adding AI message to chat...');
      setMessages(prev => [...prev, assistantMessage]);

      // Speak the AI response using browser TTS
      console.log('🔊 Starting TTS for AI response...');
      await speakAIResponse(aiResponse);

    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.',
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('🚨 Adding error message to chat...');
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log('🏁 handleSendMessage finished');
      setIsLoading(false);
      setReasoningText('');
    }
  };

  // Функция для переключения голосового режима
  const toggleVoiceMode = async () => {
    console.log('🎛️ toggleVoiceMode called, isContinuousListening:', isContinuousListening, 'isLoading:', isLoading);

    if (isContinuousListening) {
      console.log('🛑 Stopping continuous listening via toggle');
      stopListening();
    } else if (!isLoading) {
      console.log('▶️ Starting continuous listening via toggle');
      setTranscript(''); // Очищаем предыдущую транскрипцию
      setInterimTranscript('');
      startListening();
    } else {
      console.log('❌ Cannot start voice recognition: isLoading=', isLoading);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          {/* Header Section */}
          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mic className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Голосовое общение
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Говорите естественно - система автоматически распознает вашу речь и отвечает голосом.
            </p>
          </div>

          {/* Main Interface */}
          <div className="max-w-4xl mx-auto">
            <Card className="border-border/50">
              <CardContent className="p-12">
                <div className="text-center space-y-8">
                  {/* Voice Visualizer */}
                  <div className="relative">
                    <div
                      onClick={toggleVoiceMode}
                      className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-smooth cursor-pointer mx-auto ${
                        isRecording
                          ? "bg-red-500 shadow-glow animate-pulse"
                          : "bg-primary/10 hover:bg-primary/20"
                      }`}
                    >
                      {isLoading ? (
                        <Sparkles className="h-8 w-8 text-primary animate-spin" />
                      ) : isRecording ? (
                        <MicOff className="h-8 w-8 text-white" />
                      ) : (
                        <Mic className="h-8 w-8 text-primary" />
                      )}
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                      {isLoading ? reasoningText : "Галина"}
                    </h2>
                    <p className="text-muted-foreground">
                      {isLoading ? reasoningText : "Ваш AI-юрист"}
                    </p>
                  </div>


                  {/* Action buttons */}
                  <div className="flex gap-4 justify-center">
                    <Button
                      size="lg"
                      variant={isLoading ? "secondary" : isRecording ? "destructive" : "default"}
                      onClick={toggleVoiceMode}
                      disabled={isLoading}
                      className="shadow-elegant"
                    >
                      {isLoading ? (
                        <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                      ) : isRecording ? (
                        <MicOff className="h-5 w-5 mr-2" />
                      ) : (
                        <Mic className="h-5 w-5 mr-2" />
                      )}
                      {isLoading ? "Обработка..." :
                       isContinuousListening ? "Остановить прослушивание" : "Начать прослушивание"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversation History */}
            <Card className="border-border/50 mt-8">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  История разговора
                </h3>
                <div className="min-h-[300px] max-h-[400px] overflow-y-auto space-y-4">
                  {messages.length === 1 && !isRecording && !transcript ? (
                    <div className="text-center py-12">
                      <Mic className="h-12 w-12 text-muted-foreground mx-auto opacity-50 mb-4" />
                      <p className="text-muted-foreground">
                        Начните разговор для отображения истории
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium">
                                {message.role === 'user' ? 'Вы' : 'Галина'}
                              </span>
                              <span className="text-xs opacity-70">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-sm leading-relaxed">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Voice;