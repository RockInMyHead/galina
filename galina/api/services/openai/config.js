// OpenAI API Configuration and Parameter Normalization
const config = require('../../config');

// Default parameters for different OpenAI API calls
const OPENAI_DEFAULTS = {
  // Chat Completions API
  chat: {
    model: 'gpt-4o-mini',
    max_completion_tokens: 2000,
    temperature: 0.7,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    stream: false
  },

  // Text-to-Speech API
  tts: {
    model: 'tts-1',
    voice: 'alloy',
    response_format: 'mp3',
    speed: 1.0
  },

  // Speech-to-Text API
  stt: {
    model: 'whisper-1',
    language: 'ru',
    response_format: 'json',
    temperature: 0
  },

  // Vision API (for document analysis)
  vision: {
    model: 'gpt-4-turbo',
    max_completion_tokens: 1000,
    temperature: 0.1
  }
};

// Parameter validation and normalization
const normalizeChatParams = (params = {}) => {
  const defaults = OPENAI_DEFAULTS.chat;

  return {
    model: params.model || defaults.model,
    messages: params.messages || [],
    max_completion_tokens: Math.min(params.max_completion_tokens || defaults.max_completion_tokens, 4000),
    temperature: Math.max(0, Math.min(params.temperature ?? defaults.temperature, 2)),
    top_p: Math.max(0, Math.min(params.top_p ?? defaults.top_p, 1)),
    presence_penalty: Math.max(-2, Math.min(params.presence_penalty ?? defaults.presence_penalty, 2)),
    frequency_penalty: Math.max(-2, Math.min(params.frequency_penalty ?? defaults.frequency_penalty, 2)),
    stream: Boolean(params.stream)
  };
};

const normalizeTTSParams = (params = {}) => {
  const defaults = OPENAI_DEFAULTS.tts;

  return {
    model: params.model || defaults.model,
    input: params.text || params.input || '',
    voice: params.voice || defaults.voice,
    response_format: params.response_format || defaults.response_format,
    speed: Math.max(0.25, Math.min(params.speed ?? defaults.speed, 4.0))
  };
};

const normalizeSTTParams = (params = {}) => {
  const defaults = OPENAI_DEFAULTS.stt;

  return {
    model: params.model || defaults.model,
    language: params.language || defaults.language,
    response_format: params.response_format || defaults.response_format,
    temperature: Math.max(0, Math.min(params.temperature ?? defaults.temperature, 1))
  };
};

const normalizeVisionParams = (params = {}) => {
  const defaults = OPENAI_DEFAULTS.vision;

  return {
    model: params.model || defaults.model,
    messages: params.messages || [],
    max_completion_tokens: Math.min(params.max_completion_tokens || defaults.max_completion_tokens, 4000),
    temperature: Math.max(0, Math.min(params.temperature ?? defaults.temperature, 2))
  };
};

// Response format normalization
const RESPONSE_FORMATS = {
  // Legacy format (for backward compatibility with frontend)
  LEGACY: 'legacy',
  // Raw OpenAI response
  RAW: 'raw',
  // Simplified format
  SIMPLE: 'simple'
};

const formatChatResponse = (openaiResponse, format = RESPONSE_FORMATS.LEGACY) => {
  switch (format) {
    case RESPONSE_FORMATS.RAW:
      return openaiResponse;

    case RESPONSE_FORMATS.SIMPLE:
      return {
        id: openaiResponse.id,
        content: openaiResponse.choices?.[0]?.message?.content || '',
        role: openaiResponse.choices?.[0]?.message?.role || 'assistant',
        usage: openaiResponse.usage || {}
      };

    case RESPONSE_FORMATS.LEGACY:
    default:
      // Standard Chat Completions format (legacy compatibility)
      return {
        id: openaiResponse.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: openaiResponse.created || Math.floor(Date.now() / 1000),
        model: openaiResponse.model || 'gpt-40',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: openaiResponse.choices?.[0]?.message?.content || '',
            refusal: openaiResponse.choices?.[0]?.message?.refusal || null
          },
          finish_reason: openaiResponse.choices?.[0]?.finish_reason || 'stop'
        }],
        usage: openaiResponse.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
  }
};

const formatTTSResponse = (audioBuffer, format = RESPONSE_FORMATS.LEGACY) => {
  // TTS always returns audio buffer, format doesn't affect the response
  return audioBuffer;
};

const formatSTTResponse = (openaiResponse, format = RESPONSE_FORMATS.LEGACY) => {
  switch (format) {
    case RESPONSE_FORMATS.RAW:
      return openaiResponse;

    case RESPONSE_FORMATS.SIMPLE:
      return {
        text: openaiResponse.text || '',
        language: openaiResponse.language || 'ru',
        duration: openaiResponse.duration || 0
      };

    case RESPONSE_FORMATS.LEGACY:
    default:
      return {
        success: true,
        text: openaiResponse.text?.trim() || '',
        language: openaiResponse.language || 'ru',
        duration: openaiResponse.duration || 0
      };
  }
};

module.exports = {
  OPENAI_DEFAULTS,
  RESPONSE_FORMATS,
  normalizeChatParams,
  normalizeTTSParams,
  normalizeSTTParams,
  normalizeVisionParams,
  formatChatResponse,
  formatTTSResponse,
  formatSTTResponse
};
