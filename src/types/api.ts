// API Configuration Types
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface FileConfig {
  maxSize: number;
  allowedTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export interface VoiceConfig {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
}

export interface SpeechConfig {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface BeepConfig {
  frequency: number;
  duration: number;
  interval: number;
  type: OscillatorType;
}

export interface BalanceConfig {
  initialAmount: number;
  currency: string;
  storageKey: string;
}

export interface AuthConfig {
  storageKey: string;
  minPasswordLength: number;
  minNameLength: number;
}

// API Request/Response Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ChatRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface DocumentAnalysisRequest {
  content: string;
  filename: string;
  type: string;
}

// Storage Types
export interface StorageData {
  [key: string]: any;
}

// Route Types
export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  isProtected?: boolean;
  title?: string;
}
