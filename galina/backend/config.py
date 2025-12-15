"""
Vocalis Configuration Module

Loads and provides access to configuration settings from environment variables
and the .env file.
"""

import os
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables from .env file
load_dotenv()

# API Endpoints
LLM_API_ENDPOINT = os.getenv("LLM_API_ENDPOINT", "http://127.0.0.1:1234/v1/chat/completions")
TTS_API_ENDPOINT = os.getenv("TTS_API_ENDPOINT", "https://lawyer.windexs.ru/v1/audio/speech")

# Whisper Model Configuration
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny.en")

# TTS Configuration
TTS_MODEL = os.getenv("TTS_MODEL", "tts-1")
TTS_VOICE = os.getenv("TTS_VOICE", "tara")
TTS_FORMAT = os.getenv("TTS_FORMAT", "wav")

# WebSocket Server Configuration
WEBSOCKET_HOST = os.getenv("WEBSOCKET_HOST", "0.0.0.0")
WEBSOCKET_PORT = int(os.getenv("WEBSOCKET_PORT", 8000))

# WebSocket Authentication
WS_AUTH_ENABLED = os.getenv("WS_AUTH_ENABLED", "false").lower() == "true"
WS_AUTH_TOKEN = os.getenv("WS_AUTH_TOKEN", "")
WS_RATE_LIMIT_REQUESTS = int(os.getenv("WS_RATE_LIMIT_REQUESTS", 10))  # requests per minute
WS_RATE_LIMIT_WINDOW = int(os.getenv("WS_RATE_LIMIT_WINDOW", 60))  # seconds
WS_MAX_CONCURRENT_REQUESTS = int(os.getenv("WS_MAX_CONCURRENT_REQUESTS", 5))

# Audio Processing
VAD_THRESHOLD = float(os.getenv("VAD_THRESHOLD", 0.5))
VAD_BUFFER_SIZE = int(os.getenv("VAD_BUFFER_SIZE", 30))
AUDIO_SAMPLE_RATE = int(os.getenv("AUDIO_SAMPLE_RATE", 48000))

def get_config() -> Dict[str, Any]:
    """
    Returns all configuration settings as a dictionary.

    Returns:
        Dict[str, Any]: Dictionary containing all configuration settings
    """
    return {
        "llm_api_endpoint": LLM_API_ENDPOINT,
        "tts_api_endpoint": TTS_API_ENDPOINT,
        "whisper_model": WHISPER_MODEL,
        "tts_model": TTS_MODEL,
        "tts_voice": TTS_VOICE,
        "tts_format": TTS_FORMAT,
        "websocket_host": WEBSOCKET_HOST,
        "websocket_port": WEBSOCKET_PORT,
        "vad_threshold": VAD_THRESHOLD,
        "vad_buffer_size": VAD_BUFFER_SIZE,
        "audio_sample_rate": AUDIO_SAMPLE_RATE,
        "ws_auth_enabled": WS_AUTH_ENABLED,
        "ws_auth_token": WS_AUTH_TOKEN,
        "ws_rate_limit_requests": WS_RATE_LIMIT_REQUESTS,
        "ws_rate_limit_window": WS_RATE_LIMIT_WINDOW,
        "ws_max_concurrent_requests": WS_MAX_CONCURRENT_REQUESTS,
    }
