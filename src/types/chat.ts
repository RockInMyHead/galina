// Chat specific types
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  files?: File[];
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
