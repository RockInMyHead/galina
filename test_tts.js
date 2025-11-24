// Test script for TTS API
import fetch from 'node-fetch';
import fs from 'fs';

async function testTTS() {
  try {
    console.log('🧪 Testing TTS API...');

    const testText = 'Привет! Я Галина, ваш AI-юрист.';

    const response = await fetch('http://localhost:3001/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testText,
        voice: 'alloy',
        model: 'tts-1'
      })
    });

    console.log('📡 TTS response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ TTS API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    // Save the audio response to a file for testing
    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);

    console.log('✅ TTS response received:');
    console.log('Audio size:', buffer.length, 'bytes');
    console.log('Content-Type:', response.headers.get('content-type'));

    // Save to file
    fs.writeFileSync('test_tts_output.mp3', buffer);
    console.log('🎵 Audio saved to test_tts_output.mp3');

    // Basic MP3 header check
    if (buffer.length > 0) {
      const header = buffer.slice(0, 4).toString('hex');
      console.log('MP3 header bytes:', header);

      // Check for MP3 frame sync (starts with 0xFF)
      if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
        console.log('✅ Valid MP3 frame detected');
      } else if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        console.log('✅ ID3 tag detected (MP3 with metadata)');
      } else {
        console.log('⚠️ Audio format may not be standard MP3');
      }
    }

  } catch (error) {
    console.error('❌ TTS Test Error:', error.message);
  }
}

testTTS();

