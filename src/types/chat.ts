// Chat specific types
export interface ChatMessage {
  id: string;
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  role: 'user' | 'assistant';
  timestamp: Date;
  files?: File[];
  uploadedFile?: {
    name: string;
    data: string; // base64
    type: string;
  };
  audioUrl?: string;  // URL аудио сообщения
  audioDuration?: number;  // Длительность аудио в секундах
  isAudioMessage?: boolean;  // Флаг, что это аудио сообщение
}

export interface FilePreview {
  file: File;
  preview?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedFiles: FilePreview[];
  isVoiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  aiResponse: string;
  isLoading: boolean;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
