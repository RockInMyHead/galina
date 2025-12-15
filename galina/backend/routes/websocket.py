"""
WebSocket Route Handler

Handles WebSocket connections for bidirectional audio streaming.
"""

import json
import logging
import asyncio
import numpy as np
import base64
import os
from typing import Dict, Any, List, Optional, AsyncGenerator
from fastapi import WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime

from services.transcription import WhisperTranscriber
from services.llm import LLMClient
from services.tts import TTSClient
from services.auth import AuthService
from services.pipeline import UnifiedPipeline, RequestType
from services.conversation_storage import ConversationStorage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Error codes
class ErrorCode:
    # Authentication errors
    AUTH_REQUIRED = "AUTH_REQUIRED"
    SESSION_INVALID = "SESSION_INVALID"
    AUTH_TIMEOUT = "AUTH_TIMEOUT"

    # Request validation errors
    INVALID_MESSAGE_TYPE = "INVALID_MESSAGE_TYPE"
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    INVALID_REQUEST_DATA = "INVALID_REQUEST_DATA"

    # Resource limit errors
    QUEUE_FULL = "QUEUE_FULL"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    CONCURRENT_LIMIT_EXCEEDED = "CONCURRENT_LIMIT_EXCEEDED"
    RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED"
    PROCESSING_TIMEOUT = "PROCESSING_TIMEOUT"

    # Processing errors
    STT_FAILED = "STT_FAILED"
    LLM_FAILED = "LLM_FAILED"
    TTS_FAILED = "TTS_FAILED"
    VISION_FAILED = "VISION_FAILED"

    # Session management errors
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SESSION_SAVE_FAILED = "SESSION_SAVE_FAILED"
    SESSION_LOAD_FAILED = "SESSION_LOAD_FAILED"

    # Configuration errors
    CONFIG_UPDATE_FAILED = "CONFIG_UPDATE_FAILED"

    # Generic errors
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"

# WebSocket message types
class MessageType:
    AUDIO = "audio"
    TRANSCRIPTION = "transcription"
    TRANSCRIPTION_PARTIAL = "transcription_partial"
    LLM_RESPONSE = "llm_response"
    LLM_RESPONSE_PARTIAL = "llm_response_partial"
    TTS_CHUNK = "tts_chunk"
    TTS_START = "tts_start"
    TTS_END = "tts_end"
    STATUS = "status"
    ERROR = "error"
    SYSTEM_PROMPT = "system_prompt"
    SYSTEM_PROMPT_UPDATED = "system_prompt_updated"
    GREETING = "greeting"
    SILENT_FOLLOWUP = "silent_followup"
    USER_PROFILE = "user_profile"
    USER_PROFILE_UPDATED = "user_profile_updated"
    
    # Session storage message types
    SAVE_SESSION = "save_session"
    SAVE_SESSION_RESULT = "save_session_result"
    LOAD_SESSION = "load_session"
    LOAD_SESSION_RESULT = "load_session_result"
    LIST_SESSIONS = "list_sessions"
    LIST_SESSIONS_RESULT = "list_sessions_result"
    DELETE_SESSION = "delete_session"
    DELETE_SESSION_RESULT = "delete_session_result"
    
    # Vision feature message types
    VISION_SETTINGS = "vision_settings"
    VISION_SETTINGS_UPDATED = "vision_settings_updated"
    VISION_FILE_UPLOAD = "vision_file_upload"
    VISION_FILE_UPLOAD_RESULT = "vision_file_upload_result"
    VISION_PROCESSING = "vision_processing"
    VISION_READY = "vision_ready"

class WebSocketManager:
    """
    Manages WebSocket connections and delegates to unified pipeline.
    """
    
    def __init__(
        self,
        transcriber: WhisperTranscriber,
        llm_client: LLMClient,
        tts_client: TTSClient,
        auth_service: AuthService
    ):
        """
        Initialize the WebSocket manager.
        
        Args:
            transcriber: Whisper transcription service
            llm_client: LLM client service
            tts_client: TTS client service
            auth_service: Authentication service
        """
        # Create unified pipeline
        self.pipeline = UnifiedPipeline(
            transcriber=transcriber,
            llm_client=llm_client,
            tts_client=tts_client,
            auth_service=auth_service,
            max_queue_size=50,
            max_concurrent=3,
            request_timeout=30
        )
        
        # State tracking
        self.active_connections: Dict[str, WebSocket] = {}  # session_token -> websocket
        self.client_sessions: Dict[str, str] = {}  # websocket -> session_token
        
        # File paths
        self.prompt_path = os.path.join("prompts", "system_prompt.md")
        self.profile_path = os.path.join("prompts", "user_profile.json")
        self.vision_settings_path = os.path.join("prompts", "vision_settings.json")
        
        # Load settings
        self.system_prompt = self._load_system_prompt()
        self.user_profile = self._load_user_profile()
        self.vision_settings = self._load_vision_settings()
        
        # Initialize conversation storage
        self.conversation_storage = ConversationStorage()
        
        logger.info("Initialized WebSocket Manager with Unified Pipeline")
    
    def _load_system_prompt(self) -> str:
        """
        Load system prompt from file or use default if file doesn't exist.
        
        Returns:
            str: The system prompt
        """
        default_prompt = (
            "You are a helpful, friendly, and concise voice assistant."
            "Respond to user queries in a natural, conversational manner."
            "Keep responses brief and to the point, as you're communicating via voice."
            "When providing information, focus on the most relevant details."
            "If you don't know something, admit it rather than making up an answer"
            "\n\n"
            "Through the webapp, you can receive and understand photographs and pictures."
            "\n\n"
            "When the user sends a message like '[silent]', '[no response]', or '[still waiting]', it means they've gone quiet or haven't responded."
            "When you see these signals, continue the conversation naturally based on the previous topic and context."
            "Stay on topic, be helpful, and don't mention that they were silent - just carry on the conversation as if you're gently following up."
        )
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.prompt_path), exist_ok=True)
            
            # Read from file if it exists
            if os.path.exists(self.prompt_path):
                with open(self.prompt_path, "r") as f:
                    prompt = f.read().strip()
                    if prompt:  # Only use if not empty
                        return prompt
            
            # If file doesn't exist or is empty, write default prompt
            with open(self.prompt_path, "w") as f:
                f.write(default_prompt)
            
            return default_prompt
            
        except Exception as e:
            logger.error(f"Error loading system prompt: {e}")
            return default_prompt
    
    async def connect(self, websocket: WebSocket, client_ip: str):
        """
        Handle a new WebSocket connection with authentication.
        
        Args:
            websocket: The WebSocket connection
            client_ip: Client IP address for rate limiting
        """
        await websocket.accept()
        
        # Send initial connection status
        await self._send_status(websocket, "connected", {
            "message": "Connection established. Please authenticate.",
            "requires_auth": True
        })

        # Wait for authentication message
        try:
            auth_message = await asyncio.wait_for(
                websocket.receive_json(),
                timeout=10.0  # 10 second timeout for auth
            )

            if auth_message.get("type") != "authenticate":
                await self._send_error(websocket, "First message must be authentication")
                await websocket.close(code=1008)  # Policy violation
                return

            token = auth_message.get("token", "")
            success, session_token_or_error = self.pipeline.auth_service.authenticate(token, client_ip)

            if not success:
                await self._send_error(websocket, session_token_or_error)
                await websocket.close(code=1008)  # Policy violation
                return

            # Authentication successful
            session_token = session_token_or_error
            self.active_connections[session_token] = websocket
            self.client_sessions[str(id(websocket))] = session_token

            # Send authentication success
            await self._send_status(websocket, "authenticated", {
                "session_token": session_token,
                "pipeline_stats": self.pipeline.get_stats()
            })

            logger.info(f"Client authenticated successfully. Session: {session_token}")

        except asyncio.TimeoutError:
            await self._send_error(websocket, "Authentication timeout")
            await websocket.close(code=1008)
            return
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await self._send_error(websocket, "Authentication failed")
            await websocket.close(code=1008)
            return
    
    def disconnect(self, websocket: WebSocket):
        """
        Handle a WebSocket disconnection.
        
        Args:
            websocket: The WebSocket connection
        """
        websocket_id = str(id(websocket))

        # Find and remove session
        if websocket_id in self.client_sessions:
            session_token = self.client_sessions[websocket_id]
            if session_token in self.active_connections:
                del self.active_connections[session_token]
            del self.client_sessions[websocket_id]

            # Clean up expired sessions periodically (every 10 disconnections)
            if len(self.active_connections) % 10 == 0:
                self.pipeline.auth_service.cleanup_expired_sessions()

            logger.info(f"Client disconnected. Session: {session_token}, Active connections: {len(self.active_connections)}")
        else:
            logger.info("Unauthenticated client disconnected")
    
    async def _send_status(self, websocket: WebSocket, status: str, data: Dict[str, Any]):
        """
        Send a status update to a WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            status: Status message
            data: Additional data
        """
        await websocket.send_json({
            "type": MessageType.STATUS,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "data": data,
            "version": "1.0"
        })
    
    async def _validate_websocket_auth(self, websocket: WebSocket) -> Optional[str]:
        """
        Validate WebSocket authentication and return session token.

        Args:
            websocket: The WebSocket connection

        Returns:
            Session token if valid, None otherwise (error sent to client)
        """
        websocket_id = str(id(websocket))

        # Check if websocket is registered
        if websocket_id not in self.client_sessions:
            await self._send_error(websocket, "Not authenticated", {"code": "AUTH_REQUIRED"})
            return None

        session_token = self.client_sessions[websocket_id]

        # Validate session token with auth service
        is_valid, client_ip = self.pipeline.auth_service.validate_session_token(session_token)
        if not is_valid:
            # Remove invalid session
            if websocket_id in self.client_sessions:
                del self.client_sessions[websocket_id]
            if session_token in self.active_connections:
                del self.active_connections[session_token]

            await self._send_error(websocket, "Session expired or invalid", {"code": "SESSION_INVALID"})
            return None

        return session_token
    
    async def _send_error(self, websocket: WebSocket, error: str, details: Optional[Dict[str, Any]] = None):
        """
        Send an error message to a WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            error: Error message
            details: Additional error details
        """
        await websocket.send_json({
            "type": MessageType.ERROR,
            "error": error,
            "code": details.get("code", "UNKNOWN_ERROR") if details else "UNKNOWN_ERROR",
            "timestamp": datetime.now().isoformat(),
            "details": details or {},
            "version": "1.0"
        })
    
    async def _send_standard_message(self, websocket: WebSocket, message_type: str, data: Dict[str, Any]):
        """
        Send a standardized message to a WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            message_type: Message type
            data: Message data
        """
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "version": "1.0",
            **data
        }
        await websocket.send_json(message)

    def _map_error_to_code(self, error_message: str) -> str:
        """
        Map error message to standardized error code.
        
        Args:
            error_message: Error message (may contain | separated code)

        Returns:
            Error code
        """
        # Check if error message contains explicit error code
        if "|" in error_message:
            parts = error_message.split("|", 1)
            if len(parts) == 2:
                return parts[1]

        error_lower = error_message.lower()

        # Authentication errors
        if "not authenticated" in error_lower:
            return ErrorCode.AUTH_REQUIRED
        if "session" in error_lower and ("invalid" in error_lower or "expired" in error_lower):
            return ErrorCode.SESSION_INVALID

        # Resource limit errors
        if "queue is full" in error_lower:
            return ErrorCode.QUEUE_FULL
        if "rate limit" in error_lower:
            return ErrorCode.RATE_LIMIT_EXCEEDED
        if "concurrent" in error_lower:
            return ErrorCode.CONCURRENT_LIMIT_EXCEEDED
        if "timeout" in error_lower:
            return ErrorCode.PROCESSING_TIMEOUT
        if "size" in error_lower and ("exceeds" in error_lower or "too large" in error_lower):
            return ErrorCode.RESOURCE_LIMIT_EXCEEDED

        # Processing errors
        if "transcription" in error_lower or "stt" in error_lower:
            return ErrorCode.STT_FAILED
        if "llm" in error_lower:
            return ErrorCode.LLM_FAILED
        if "tts" in error_lower:
            return ErrorCode.TTS_FAILED
        if "vision" in error_lower:
            return ErrorCode.VISION_FAILED

        # Session management errors
        if "session not found" in error_lower:
            return ErrorCode.SESSION_NOT_FOUND
        if "save" in error_lower and "failed" in error_lower:
            return ErrorCode.SESSION_SAVE_FAILED
        if "load" in error_lower and "failed" in error_lower:
            return ErrorCode.SESSION_LOAD_FAILED

        # Default to unknown error
        return ErrorCode.UNKNOWN_ERROR
    
    # Audio processing methods removed - now handled by unified pipeline
    
    def _load_user_profile(self) -> Dict[str, Any]:
        """
        Load user profile from file or create a default one if it doesn't exist.
        
        Returns:
            Dict[str, Any]: The user profile
        """
        default_profile = {
            "name": "",
            "preferences": {}
        }
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.profile_path), exist_ok=True)
            
            # Read from file if it exists
            if os.path.exists(self.profile_path):
                with open(self.profile_path, "r") as f:
                    profile = json.load(f)
                    if profile:  # Only use if not empty
                        return profile
            
            # If file doesn't exist or is empty, write default profile
            with open(self.profile_path, "w") as f:
                json.dump(default_profile, f, indent=2)
            
            return default_profile
            
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")
            return default_profile
    
    def _save_user_profile(self) -> bool:
        """
        Save user profile to file.
        
        Returns:
            bool: Whether the save was successful
        """
        try:
            os.makedirs(os.path.dirname(self.profile_path), exist_ok=True)
            with open(self.profile_path, "w") as f:
                json.dump(self.user_profile, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving user profile: {e}")
            return False
    
    def _get_user_name(self) -> str:
        """Get the user's name from the profile, or empty string if not set."""
        return self.user_profile.get("name", "")
    
    def _set_user_name(self, name: str) -> bool:
        """
        Set the user's name in the profile.
        
        Args:
            name: User name to set
            
        Returns:
            bool: Whether the update was successful
        """
        self.user_profile["name"] = name
        return self._save_user_profile()
    
    # Prompt generation methods moved to unified pipeline

    # Conversation context initialization moved to unified pipeline

    # Greeting and silent followup handlers removed - now handled by unified pipeline
    
    async def _handle_save_session(self, websocket: WebSocket, title: Optional[str] = None, session_id: Optional[str] = None):
        """
        Handle save session request.
        
        Args:
            websocket: The WebSocket connection
            title: Optional title for the session
            session_id: Optional ID for the session (for overwriting existing)
        """
        try:
            # Get current conversation history from LLM client
            messages = self.llm_client.conversation_history.copy()
            
            # Don't save empty conversations
            if not messages:
                # Send proper save result with failure instead of generic error
                await websocket.send_json({
                    "type": MessageType.SAVE_SESSION_RESULT,
                    "success": False,
                    "error": "Cannot save empty conversation",
                    "timestamp": datetime.now().isoformat()
                })
                return
            
            # Generate metadata (timestamp, message count, etc.)
            metadata = {
                "message_count": len(messages),
                "user_message_count": sum(1 for m in messages if m.get("role") == "user"),
                "assistant_message_count": sum(1 for m in messages if m.get("role") == "assistant"),
                "user_name": self._get_user_name() or "Anonymous",
            }
            # Save session (now async)
            session_id = await self.conversation_storage.save_session(
                messages=messages,
                title=title,
                session_id=session_id,
                metadata=metadata
            )
            
            # Send confirmation
            await websocket.send_json({
                "type": MessageType.SAVE_SESSION_RESULT,
                "success": True,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"Saved conversation session: {session_id}")
            
        except Exception as e:
            logger.error(f"Error saving session: {e}")
            await self._send_error(websocket, f"Failed to save conversation: {str(e)}")
    
    async def _handle_load_session(self, websocket: WebSocket, session_id: str):
        """
        Handle load session request.
        
        Args:
            websocket: The WebSocket connection
            session_id: ID of the session to load
        """
        try:
            # Load session (now async)
            session = await self.conversation_storage.load_session(session_id)

            if not session:
                await self._send_error(websocket, f"Session not found: {session_id}")
                return
            
            # Update LLM client's conversation history
            self.llm_client.conversation_history = session.get("messages", [])
            
            # Send confirmation
            await websocket.send_json({
                "type": MessageType.LOAD_SESSION_RESULT,
                "success": True,
                "session_id": session_id,
                "title": session.get("title", ""),
                "message_count": len(session.get("messages", [])),
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"Loaded conversation session: {session_id}")
            
        except Exception as e:
            logger.error(f"Error loading session: {e}")
            await self._send_error(websocket, f"Failed to load conversation: {str(e)}")
    
    async def _handle_list_sessions(self, websocket: WebSocket):
        """
        Handle list sessions request.
        
        Args:
            websocket: The WebSocket connection
        """
        try:
            # Get sessions (now async)
            sessions = await self.conversation_storage.list_sessions()

            # Send list
            await websocket.send_json({
                "type": MessageType.LIST_SESSIONS_RESULT,
                "sessions": sessions,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"Listed {len(sessions)} conversation sessions")
            
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
            await self._send_error(websocket, f"Failed to list conversations: {str(e)}")
    
    async def _handle_delete_session(self, websocket: WebSocket, session_id: str):
        """
        Handle delete session request.
        
        Args:
            websocket: The WebSocket connection
            session_id: ID of the session to delete
        """
        try:
            # Delete session (now async)
            success = await self.conversation_storage.delete_session(session_id)

            # Send confirmation
            await websocket.send_json({
                "type": MessageType.DELETE_SESSION_RESULT,
                "success": success,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            })
            
            if success:
                logger.info(f"Deleted conversation session: {session_id}")
            else:
                logger.warning(f"Failed to delete conversation session: {session_id}")
            
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            await self._send_error(websocket, f"Failed to delete conversation: {str(e)}")
    
    async def handle_client_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """
        Handle a message from a WebSocket client.
        
        Args:
            websocket: The WebSocket connection
            message: The message from the client
        """
        try:
            # Validate authentication for this websocket
            session_token = await self._validate_websocket_auth(websocket)
            if not session_token:
                return  # Error already sent

            message_type = message.get("type", "")
            
            # Pipeline requests (main functionality)
            if message_type == MessageType.AUDIO:
                audio_base64 = message.get("audio_data", "")
                if audio_base64:
                    audio_bytes = base64.b64decode(audio_base64)
                    await self.pipeline.submit_request(
                        RequestType.AUDIO,
                        message.get("client_ip", "unknown"),
                        session_token,
                        websocket,
                        {"audio_bytes": audio_bytes}
                    )
                
            elif message_type == MessageType.GREETING:
                await self.pipeline.submit_request(
                    RequestType.GREETING,
                    message.get("client_ip", "unknown"),
                    session_token,
                    websocket,
                    {}
                )
                
            elif message_type == MessageType.SILENT_FOLLOWUP:
                tier = message.get("tier", 0)
                await self.pipeline.submit_request(
                    RequestType.SILENT_FOLLOWUP,
                    message.get("client_ip", "unknown"),
                    session_token,
                    websocket,
                    {"tier": tier}
                )

            # Vision handling
            elif message_type == MessageType.VISION_FILE_UPLOAD:
                image_base64 = message.get("image_data", "")
                if image_base64:
                    await self._handle_vision_file_upload(websocket, session_token, image_base64)

            # Configuration and settings
            elif message_type == "get_system_prompt":
                await self._handle_get_system_prompt(websocket)
                
            elif message_type == "update_system_prompt":
                new_prompt = message.get("prompt", "")
                if new_prompt:
                    await self._handle_update_system_prompt(websocket, new_prompt)
                else:
                    await self._send_error(websocket, "Empty system prompt")
                    
            elif message_type == "get_user_profile":
                await self._handle_get_user_profile(websocket)
                
            elif message_type == "update_user_profile":
                name = message.get("name", "")
                await self._handle_update_user_profile(websocket, name)
            
            elif message_type == "get_vision_settings":
                await self._handle_get_vision_settings(websocket)
                
            elif message_type == "update_vision_settings":
                enabled = message.get("enabled", False)
                await self._handle_update_vision_settings(websocket, enabled)
                
            # Session management
            elif message_type == MessageType.SAVE_SESSION:
                title = message.get("title")
                session_id = message.get("session_id")
                await self._handle_save_session(websocket, title, session_id)
                
            elif message_type == MessageType.LOAD_SESSION:
                session_id = message.get("session_id")
                if not session_id:
                    await self._send_error(websocket, "Session ID is required")
                    return
                await self._handle_load_session(websocket, session_id)
                
            elif message_type == MessageType.LIST_SESSIONS:
                await self._handle_list_sessions(websocket)
                
            elif message_type == MessageType.DELETE_SESSION:
                session_id = message.get("session_id")
                if not session_id:
                    await self._send_error(websocket, "Session ID is required")
                    return
                await self._handle_delete_session(websocket, session_id)
                
            # Utility messages
            elif message_type == "clear_history":
                # Clear conversation history in pipeline's LLM client
                self.pipeline.llm_client.clear_history(keep_system_prompt=True)
                self.pipeline._initialize_conversation_context()
                await self._send_status(websocket, "history_cleared", {})

            elif message_type == "interrupt":
                # For now, just acknowledge - pipeline handles its own interruption
                await self._send_status(websocket, "interrupt_acknowledged", {})

            elif message_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
            
            elif message_type == "pong":
                # Silently accept pong messages
                pass
                
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self._send_error(websocket, f"Unknown message type: {message_type}")
                
        except ValueError as e:
            # Pipeline validation errors (rate limits, queue full, etc.)
            error_msg = str(e)
            error_code = self._map_error_to_code(error_msg)
            await self._send_error(websocket, error_msg, {"code": error_code})
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
            await self._send_error(websocket, "Internal server error", {"code": ErrorCode.INTERNAL_ERROR})
    
    async def _handle_get_user_profile(self, websocket: WebSocket):
        """
        Send the current user profile to the client.
        
        Args:
            websocket: The WebSocket connection
        """
        try:
            await websocket.send_json({
                "type": MessageType.USER_PROFILE,
                "name": self._get_user_name(),
                "timestamp": datetime.now().isoformat()
            })
            logger.info("Sent user profile to client")
        except Exception as e:
            logger.error(f"Error sending user profile: {e}")
            await self._send_error(websocket, f"Error sending user profile: {str(e)}")
    
    async def _handle_update_user_profile(self, websocket: WebSocket, name: str):
        """
        Update the user profile.
        
        Args:
            websocket: The WebSocket connection
            name: User name to set
        """
        try:
            # Update name
            success = self._set_user_name(name)
            
            # Update conversation context with the new name
            if success:
                # Initialize conversation context with the updated name
                self._initialize_conversation_context()
                logger.info(f"Updated user profile name to: {name} and refreshed conversation context")
            else:
                logger.error("Failed to update user profile")
            
            # Send confirmation
            await websocket.send_json({
                "type": MessageType.USER_PROFILE_UPDATED,
                "success": success,
                "timestamp": datetime.now().isoformat()
            })
            
            if not success:
                await self._send_error(websocket, "Failed to update user profile")
                
        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            await self._send_error(websocket, f"Error updating user profile: {str(e)}")
            
    async def _handle_get_system_prompt(self, websocket: WebSocket):
        """
        Send the current system prompt to the client.
        
        Args:
            websocket: The WebSocket connection
        """
        try:
            await websocket.send_json({
                "type": MessageType.SYSTEM_PROMPT,
                "prompt": self.system_prompt,
                "timestamp": datetime.now().isoformat()
            })
            logger.info("Sent system prompt to client")
        except Exception as e:
            logger.error(f"Error sending system prompt: {e}")
            await self._send_error(websocket, f"Error sending system prompt: {str(e)}")
    
    def _load_vision_settings(self) -> Dict[str, Any]:
        """
        Load vision settings from file or create a default one if it doesn't exist.
        
        Returns:
            Dict[str, Any]: The vision settings
        """
        default_settings = {
            "enabled": False
        }
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.vision_settings_path), exist_ok=True)
            
            # Read from file if it exists
            if os.path.exists(self.vision_settings_path):
                with open(self.vision_settings_path, "r") as f:
                    settings = json.load(f)
                    if settings:  # Only use if not empty
                        return settings
            
            # If file doesn't exist or is empty, write default settings
            with open(self.vision_settings_path, "w") as f:
                json.dump(default_settings, f, indent=2)
            
            return default_settings
            
        except Exception as e:
            logger.error(f"Error loading vision settings: {e}")
            return default_settings
    
    def _save_vision_settings(self) -> bool:
        """
        Save vision settings to file.
        
        Returns:
            bool: Whether the save was successful
        """
        try:
            os.makedirs(os.path.dirname(self.vision_settings_path), exist_ok=True)
            with open(self.vision_settings_path, "w") as f:
                json.dump(self.vision_settings, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving vision settings: {e}")
            return False
    
    async def _handle_get_vision_settings(self, websocket: WebSocket):
        """
        Send the current vision settings to the client.
        
        Args:
            websocket: The WebSocket connection
        """
        try:
            await websocket.send_json({
                "type": MessageType.VISION_SETTINGS,
                "enabled": self.vision_settings.get("enabled", False),
                "timestamp": datetime.now().isoformat()
            })
            logger.info("Sent vision settings to client")
        except Exception as e:
            logger.error(f"Error sending vision settings: {e}")
            await self._send_error(websocket, f"Error sending vision settings: {str(e)}")
    
    async def _handle_update_vision_settings(self, websocket: WebSocket, enabled: bool):
        """
        Update the vision settings.
        
        Args:
            websocket: The WebSocket connection
            enabled: Whether vision is enabled
        """
        try:
            # Update in memory
            self.vision_settings["enabled"] = enabled
            
            # Save to file
            success = self._save_vision_settings()
            
            # Send confirmation
            await websocket.send_json({
                "type": MessageType.VISION_SETTINGS_UPDATED,
                "success": success,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info(f"Updated vision settings: enabled={enabled}")
        except Exception as e:
            logger.error(f"Error updating vision settings: {e}")
            await self._send_error(websocket, f"Error updating vision settings: {str(e)}")
    
    async def _handle_update_system_prompt(self, websocket: WebSocket, new_prompt: str):
        """
        Update the system prompt.
        
        Args:
            websocket: The WebSocket connection
            new_prompt: New system prompt
        """
        try:
            # Validate prompt (basic check for non-empty)
            if not new_prompt.strip():
                await self._send_error(websocket, "System prompt cannot be empty")
                return
            
            # Update in memory
            self.system_prompt = new_prompt
            
            # Save to file
            os.makedirs(os.path.dirname(self.prompt_path), exist_ok=True)
            with open(self.prompt_path, "w") as f:
                f.write(new_prompt)
            
            # Send confirmation
            await websocket.send_json({
                "type": MessageType.SYSTEM_PROMPT_UPDATED,
                "success": True,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info("Updated system prompt")
        except Exception as e:
            logger.error(f"Error updating system prompt: {e}")
            await self._send_error(websocket, f"Error updating system prompt: {str(e)}")
            
    # Vision context handling moved to unified pipeline
    
    async def _handle_vision_file_upload(self, websocket: WebSocket, session_token: str, image_base64: str):
        """
        Handle vision image upload from client.
        
        Args:
            websocket: The WebSocket connection
            session_token: Client session token
            image_base64: Base64-encoded image data
        """
        try:
            # Validate vision is enabled
            if not self.vision_settings.get("enabled", False):
                await self._send_error(websocket, "Vision feature is not enabled")
                return
                
            # Notify client that upload was received
            await websocket.send_json({
                "type": MessageType.VISION_FILE_UPLOAD_RESULT,
                "success": True,
                "timestamp": datetime.now().isoformat()
            })
            
            # Send processing status
            await websocket.send_json({
                "type": MessageType.VISION_PROCESSING,
                "status": "Analyzing image...",
                "timestamp": datetime.now().isoformat()
            })
            
            # Process image with vision service
            logger.info("Processing vision image with SmolVLM")
            
            # Import vision service (to avoid circular imports)
            from services.vision import vision_service
            
            # Create a descriptive prompt for the image
            prompt = "Describe this image in detail. Include information about objects, people, scenes, text, and any notable elements."
            
            # Process the image (run in a thread pool to not block the event loop)
            vision_context = await asyncio.to_thread(
                vision_service.process_image,
                image_base64,
                prompt
            )
            
            # Store the vision context in pipeline for this session
            # Note: This is a simplified approach - in production you'd want per-session vision context
            self.pipeline.current_vision_context = vision_context
            
            # Send vision ready notification with the generated context
            await websocket.send_json({
                "type": MessageType.VISION_READY,
                "context": vision_context,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info("Vision processing complete with SmolVLM model")
        except Exception as e:
            logger.error(f"Error processing vision image: {e}")
            await self._send_error(websocket, f"Vision processing error: {str(e)}")

async def websocket_endpoint(
    websocket: WebSocket,
    transcriber: WhisperTranscriber,
    llm_client: LLMClient,
    tts_client: TTSClient,
    auth_service: AuthService
):
    """
    FastAPI WebSocket endpoint.
    
    Args:
        websocket: The WebSocket connection
        transcriber: Whisper transcription service
        llm_client: LLM client service
        tts_client: TTS client service
        auth_service: Authentication service
    """
    # Get client IP for rate limiting
    client_ip = websocket.client.host if websocket.client else "unknown"

    # Create WebSocket manager
    manager = WebSocketManager(transcriber, llm_client, tts_client, auth_service)

    # Start the pipeline
    await manager.pipeline.start()
    
    try:
        # Accept connection and authenticate
        await manager.connect(websocket, client_ip)
        
        # Handle messages
        while True:
            try:
                # Receive message with a timeout
                message = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0  # 30 second timeout
                )
                
                # Process message
                await manager.handle_client_message(websocket, message)
                
            except asyncio.TimeoutError:
                # Send a ping to keep the connection alive
                await websocket.send_json({
                    "type": "ping",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Disconnect
        manager.disconnect(websocket)
