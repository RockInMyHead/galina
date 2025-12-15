// Unified OpenAI API Adapter with normalized contracts
const { fetchWithProxy } = require('../../config/proxy');
const config = require('../../config');
const {
  normalizeChatParams,
  normalizeTTSParams,
  normalizeSTTParams,
  normalizeVisionParams,
  formatChatResponse,
  formatTTSResponse,
  formatSTTResponse,
  RESPONSE_FORMATS
} = require('./config');

class OpenAIAdapter {
  constructor() {
    this.apiKey = config.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
    this.defaultResponseFormat = RESPONSE_FORMATS.LEGACY;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers
    };

    const response = await fetchWithProxy(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => ({}));
      console.error(`❌ OpenAI API error for ${endpoint}:`, response.status, errorData);

      // Convert OpenAI API errors (401/403) to 500 to avoid confusion with user auth errors
      if (response.status === 401 || response.status === 403) {
        throw new Error(`OpenAI API authentication failed: ${response.status}`);
      }

      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    return response;
  }

  // Chat Completions API with normalized parameters and response format
  async createChatCompletion(params = {}, responseFormat = this.defaultResponseFormat) {
    const normalizedParams = normalizeChatParams(params);

    if (normalizedParams.stream) {
      return this.makeRequest('/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedParams)
      });
    } else {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedParams)
      });

      const data = await response.json();
      return formatChatResponse(data, responseFormat);
    }
  }

  // Text-to-Speech API with normalized parameters
  async createSpeech(params = {}, responseFormat = this.defaultResponseFormat) {
    const normalizedParams = normalizeTTSParams(params);

    const response = await this.makeRequest('/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedParams)
    });

    const audioBuffer = await response.arrayBuffer();
    return formatTTSResponse(audioBuffer, responseFormat);
  }

  // Speech-to-Text API with normalized parameters and response format
  async createTranscription(audioBuffer, params = {}, responseFormat = this.defaultResponseFormat) {
    const normalizedParams = normalizeSTTParams(params);

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', normalizedParams.model);
    formData.append('language', normalizedParams.language);
    formData.append('response_format', normalizedParams.response_format);

    const response = await this.makeRequest('/audio/transcriptions', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    return formatSTTResponse(data, responseFormat);
  }

  // Vision API for document analysis with normalized parameters
  async createVisionCompletion(params = {}, responseFormat = this.defaultResponseFormat) {
    const normalizedParams = normalizeVisionParams(params);

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedParams)
    });

    const data = await response.json();
    return formatChatResponse(data, responseFormat);
  }

  // Check if API key is valid
  async validateApiKey() {
    if (!this.apiKey) return false;

    try {
      await this.makeRequest('/models', { method: 'GET' });
      return true;
    } catch (error) {
      console.log('❌ OpenAI API key validation failed:', error.message);
      return false;
    }
  }

  // Set default response format for all operations
  setDefaultResponseFormat(format) {
    if (Object.values(RESPONSE_FORMATS).includes(format)) {
      this.defaultResponseFormat = format;
    } else {
      throw new Error(`Invalid response format: ${format}`);
    }
  }
}

module.exports = new OpenAIAdapter();
