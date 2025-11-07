// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}

export interface DocumentTemplate {
  name: string;
  description: string;
  requestText: string;
}

export interface WalletState {
  balance: number;
  isTopUpDialogOpen: boolean;
  topUpAmount: string;
}

export interface DocumentAnalysisState {
  isDragging: boolean;
  selectedFile: File | null;
  isAnalyzing: boolean;
  analysisResult: string | null;
}

export interface DocumentFillingState {
  isScanning: boolean;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatApiResponse extends ApiResponse {
  data?: {
    content: string;
  };
}

// File Handling Types
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ProcessedFile {
  file: File;
  content: string;
  type: 'text' | 'pdf' | 'image' | 'document';
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Navigation Types
export interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Theme and UI Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}
