// Text-to-Speech routes
const express = require('express');
const router = express.Router();
const openaiAdapter = require('../services/openai/adapter');
const config = require('../config');

// Text to Speech endpoint
router.post('/', async (req, res) => {
  try {
    const { text, voice, model } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = config.OPENAI_API_KEY;
    console.log('🔑 TTS API Key check:', {
      exists: !!apiKey,
      length: apiKey?.length,
      keyPreview: apiKey ? `"${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}"` : 'null'
    });

    // Check if API key exists and is valid
    let apiKeyValid = false;
    if (apiKey) {
      try {
        console.log('🔍 Testing OpenAI API key validity for TTS...');
        // Quick test request to check if API key works
        const testResponse = await openaiAdapter.validateApiKey();
        apiKeyValid = testResponse;
        console.log('🔑 TTS API key valid:', apiKeyValid);
        if (!apiKeyValid) {
          console.log('❌ API key validation failed, response status:', testResponse);
        }
      } catch (error) {
        console.log('❌ TTS API key test failed:', error.message);
        apiKeyValid = false;
      }
    } else {
      console.log('❌ No OPENAI_API_KEY environment variable found');
    }

    // Use demo mode if API key is not valid
    if (!apiKey || !apiKeyValid) {
      console.log('⚠️ TTS API key not valid, using demo mode');
      // Mock response for testing - return a simple audio placeholder
      const mockAudio = Buffer.from([
        0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]); // Minimal MP3 frame
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', mockAudio.length);
      return res.send(mockAudio);
    }

    console.log('🎵 Requesting TTS from OpenAI:', { text: text.substring(0, 50), voice, model });

    const audioBuffer = await openaiAdapter.createSpeech({
      text,
      voice,
      model,
      response_format: 'mp3'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
