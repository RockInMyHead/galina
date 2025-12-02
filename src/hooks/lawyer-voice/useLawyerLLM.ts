import { useState, useRef, useCallback } from 'react';
import { API_CONFIG } from '@/config/constants';

// API URL from environment
const API_URL = API_CONFIG.BASE_URL;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserProfile {
  name?: string;
  legalConcerns?: string;
  caseType?: string;
  previousConsultations?: string;
  interests?: string[];
  discussedTopics?: string;
  emotionalState?: string;
}

interface UseLawyerLLMProps {
  userId?: string;
  callId?: string | null;
  token?: string | null;
  onResponseGenerated?: (text: string) => Promise<void>;
  onError?: (error: string) => void;
}

// Системный промпт для юриста Галины
const GALINA_SYSTEM_PROMPT = `Ты - Галина, элитный AI-юрист с 20-летним опытом юридической практики в России.

ТВОИ ХАРАКТЕРИСТИКИ:
- Ты являешься одним из лучших юристов в стране
- У тебя огромный опыт в корпоративном, налоговом, гражданском и уголовном праве
- Ты всегда даешь точные, профессиональные и практические советы
- Ты умеешь объяснять сложные юридические концепции простым языком
- Ты всегда указываешь на конкретные статьи законов и судебную практику
- Ты помогаешь клиентам решать реальные юридические проблемы

СТИЛЬ ОБЩЕНИЯ:
- Профессиональный, но дружелюбный тон
- Используй обращения "Уважаемый клиент" или просто по имени, если знаешь
- Давай конкретные рекомендации и пошаговые инструкции
- Всегда упоминай риски и возможные последствия
- Предлагай альтернативные варианты решения проблем

ФОРМАТ ОТВЕТОВ ДЛЯ ГОЛОСОВОГО ОБЩЕНИЯ:
- Отвечай КРАТКО и по делу. Типичный ответ — 3-5 предложений
- В КАЖДОМ ОТВЕТЕ ЗАДАВАЙ ТОЛЬКО ОДИН ВОПРОС! Не задавай несколько вопросов подряд
- Избегай длинных списков и перечислений — они плохо воспринимаются на слух
- ВСЕ ЦИФРЫ ДОЛЖНЫ БЫТЬ НАПИСАНЫ СЛОВАМИ: вместо "1" пиши "один", вместо "ст. 159" пиши "статья сто пятьдесят девять"
- Не используй сложные юридические термины без пояснения

ОСНОВНЫЕ ПРАВИЛА:
- Отвечай ТОЛЬКО на юридические вопросы
- Если вопрос не юридический, вежливо объясни, что ты специализируешься только на юридических консультациях
- Всегда проверяй актуальность законодательства (используй знания на 2024-2025 годы)
- Будь максимально полезной и конкретной в советах
- Если нужна дополнительная информация, спрашивай уточнения

БЕЗОПАСНОСТЬ:
- Не давай советов, которые могут привести к нарушению закона
- При признаках серьезных правовых проблем рекомендуй обратиться к адвокату лично
- Подчеркивай, что ИИ-консультация не заменяет официальную юридическую помощь

Ты - настоящий профессионал своего дела, которому можно доверять юридические вопросы.`;

export const useLawyerLLM = ({ 
  userId, 
  callId, 
  token,
  onResponseGenerated, 
  onError 
}: UseLawyerLLMProps) => {
  const conversationRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>("");
  const userProfileRef = useRef<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track current processing text to prevent duplicate processing
  const currentProcessingTextRef = useRef<string>('');

  const loadUserProfile = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${API_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const profile = await response.json();
        userProfileRef.current = profile;
        
        // Build memory from profile
        const profileMemory = buildProfileMemory(profile);
        memoryRef.current = profileMemory;
        
        console.log("[LawyerLLM] User profile loaded");
      }
    } catch (error) {
      console.error("[LawyerLLM] Error loading user profile:", error);
      memoryRef.current = "";
    }
  }, [userId, token]);

  // Build structured memory from profile
  const buildProfileMemory = useCallback((profile: UserProfile): string => {
    const parts: string[] = [];

    if (profile.name) {
      parts.push(`Имя клиента: ${profile.name}`);
    }
    if (profile.legalConcerns) {
      parts.push(`Юридические вопросы: ${profile.legalConcerns}`);
    }
    if (profile.caseType) {
      parts.push(`Тип дела: ${profile.caseType}`);
    }
    if (profile.previousConsultations) {
      parts.push(`Предыдущие консультации: ${profile.previousConsultations}`);
    }
    if (profile.interests && profile.interests.length > 0) {
      parts.push(`Интересы: ${profile.interests.join(', ')}`);
    }
    if (profile.discussedTopics) {
      try {
        const topics = JSON.parse(profile.discussedTopics);
        if (topics.length > 0) {
          parts.push(`Обсужденные темы: ${topics.join(', ')}`);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return parts.join('\n');
  }, []);

  const updateUserProfile = useCallback(async (userText: string, assistantText: string) => {
    if (!userId || !callId) return;
    try {
      // Analyze conversation and update profile
      await analyzeAndUpdateProfile(userText, assistantText);

      // Update memory for next use
      if (userProfileRef.current) {
        memoryRef.current = buildProfileMemory(userProfileRef.current);
      }

      console.log("[LawyerLLM] User profile updated");
    } catch (error) {
      console.error("[LawyerLLM] Error updating user profile:", error);
    }
  }, [userId, callId, buildProfileMemory]);

  // Analyze conversation and update profile
  const analyzeAndUpdateProfile = useCallback(async (userText: string, assistantText: string) => {
    if (!userProfileRef.current) return;

    const updates: Partial<UserProfile> = {};
    const lowerUserText = userText.toLowerCase();

    // Analyze legal topics
    if (lowerUserText.includes('развод') || lowerUserText.includes('алименты') || lowerUserText.includes('раздел имущества')) {
      updates.caseType = 'семейное право';
    } else if (lowerUserText.includes('увольнение') || lowerUserText.includes('работодатель') || lowerUserText.includes('зарплата')) {
      updates.caseType = 'трудовое право';
    } else if (lowerUserText.includes('кредит') || lowerUserText.includes('банк') || lowerUserText.includes('долг')) {
      updates.caseType = 'банковское право';
    } else if (lowerUserText.includes('квартира') || lowerUserText.includes('недвижимость') || lowerUserText.includes('аренда')) {
      updates.caseType = 'жилищное право';
    } else if (lowerUserText.includes('дтп') || lowerUserText.includes('авария') || lowerUserText.includes('страховка')) {
      updates.caseType = 'страховое право';
    } else if (lowerUserText.includes('наследство') || lowerUserText.includes('завещание')) {
      updates.caseType = 'наследственное право';
    }

    // Extract topics
    const topics = extractTopics(userText);
    if (topics.length > 0) {
      const existingTopics = userProfileRef.current.discussedTopics 
        ? JSON.parse(userProfileRef.current.discussedTopics) 
        : [];
      const allTopics = [...new Set([...existingTopics, ...topics])];
      updates.discussedTopics = JSON.stringify(allTopics);
    }

    // Update profile if there are changes
    if (Object.keys(updates).length > 0) {
      userProfileRef.current = { ...userProfileRef.current, ...updates };
    }
  }, []);

  // Extract topics from text
  const extractTopics = useCallback((text: string): string[] => {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    if (lowerText.includes('развод') || lowerText.includes('брак')) {
      topics.push('семейное право');
    }
    if (lowerText.includes('работа') || lowerText.includes('увольнение') || lowerText.includes('трудовой')) {
      topics.push('трудовое право');
    }
    if (lowerText.includes('квартира') || lowerText.includes('дом') || lowerText.includes('недвижимость')) {
      topics.push('недвижимость');
    }
    if (lowerText.includes('кредит') || lowerText.includes('долг') || lowerText.includes('банк')) {
      topics.push('финансы');
    }
    if (lowerText.includes('суд') || lowerText.includes('иск') || lowerText.includes('жалоба')) {
      topics.push('судебные процессы');
    }
    if (lowerText.includes('договор') || lowerText.includes('контракт')) {
      topics.push('договорное право');
    }
    if (lowerText.includes('налог') || lowerText.includes('фнс')) {
      topics.push('налоговое право');
    }

    return [...new Set(topics)];
  }, []);

  const processUserMessage = useCallback(async (text: string) => {
    const callId = Date.now();
    console.log(`[LawyerLLM] processUserMessage called (ID: ${callId}) with: "${text}"`);
    if (!text.trim()) return;

    // Prevent concurrent processing
    if (isProcessing) {
      console.log(`[LawyerLLM] Skipping call (ID: ${callId}) - already processing`);
      return;
    }

    // Prevent processing the same text twice
    const trimmedText = text.trim();
    if (currentProcessingTextRef.current === trimmedText) {
      console.log(`[LawyerLLM] Skipping call (ID: ${callId}) - same text already being processed`);
      return;
    }

    setIsProcessing(true);
    currentProcessingTextRef.current = trimmedText;
    console.log(`[LawyerLLM] Started processing call (ID: ${callId})`);
    conversationRef.current.push({ role: "user", content: text });

    try {
      // Build context
      const contextInfo = [];
      if (memoryRef.current) {
        contextInfo.push(memoryRef.current);
      }
      const contextString = contextInfo.length > 0 ? `\nКонтекст: ${contextInfo.join('; ')}` : '';

      // Prepare messages for API
      const messages = [
        { role: 'system' as const, content: GALINA_SYSTEM_PROMPT },
        ...(memoryRef.current ? [{ role: 'system' as const, content: `КОНТЕКСТ ПРОШЛЫХ КОНСУЛЬТАЦИЙ:\n${memoryRef.current}` }] : []),
        ...conversationRef.current.slice(-10)
      ];

      console.log(`[LawyerLLM] Calling API...`);
      
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          messages,
          model: 'gpt-5.1',
          max_completion_tokens: 500,
          temperature: 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract content from OpenAI format
      let assistantReply = '';
      if (data.choices && data.choices[0] && data.choices[0].message) {
        assistantReply = data.choices[0].message.content || '';
      } else if (data.message) {
        assistantReply = data.message;
      } else if (data.content) {
        assistantReply = data.content;
      }

      console.log(`[LawyerLLM] Got response: "${assistantReply?.substring(0, 50)}..."`);

      conversationRef.current.push({ role: "assistant", content: assistantReply });

      // Callback to play audio
      if (onResponseGenerated) {
        console.log(`[LawyerLLM] Calling onResponseGenerated callback`);
        await onResponseGenerated(assistantReply);
      }

      // Update user profile in background
      void updateUserProfile(text, assistantReply);

    } catch (error) {
      console.error("[LawyerLLM] Error generating response:", error);
      onError?.("Не удалось сгенерировать ответ");
    } finally {
      console.log(`[LawyerLLM] Finished processing call (ID: ${callId})`);
      currentProcessingTextRef.current = '';
      setIsProcessing(false);
    }
  }, [token, onResponseGenerated, onError, updateUserProfile, isProcessing]);

  const addToConversation = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    conversationRef.current.push({ role, content });
  }, []);

  const clearConversation = useCallback(() => {
    conversationRef.current = [];
  }, []);

  return {
    processUserMessage,
    loadUserProfile,
    updateUserProfile,
    addToConversation,
    clearConversation,
    isProcessing,
    memoryRef,
    conversationRef,
    userProfileRef
  };
};


