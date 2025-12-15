"""
Unified Pipeline Service

Handles STT → LLM → TTS pipeline with proper queuing, authentication, and resource management.
"""

import asyncio
import logging
import time
import heapq
from typing import Dict, Any, Optional, Callable, Awaitable, List, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

from .transcription import WhisperTranscriber
from .llm import LLMClient
from .tts import TTSClient
from .auth import AuthService

logger = logging.getLogger(__name__)

# Error codes for pipeline
class PipelineErrorCode:
    # Authentication errors
    INVALID_SESSION = "INVALID_SESSION"

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
    INVALID_REQUEST_TYPE = "INVALID_REQUEST_TYPE"
    EMPTY_TRANSCRIPT = "EMPTY_TRANSCRIPT"

    # Generic errors
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class PipelineStage(Enum):
    """Pipeline processing stages."""
    IDLE = "idle"
    AUTHENTICATING = "authenticating"
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    PROCESSING_LLM = "processing_llm"
    GENERATING_SPEECH = "generating_speech"
    COMPLETED = "completed"
    ERROR = "error"


class RequestType(Enum):
    """Types of requests the pipeline can handle."""
    GREETING = "greeting"
    AUDIO = "audio"
    SILENT_FOLLOWUP = "silent_followup"


@dataclass
class PipelineRequest:
    """Represents a request in the pipeline."""
    request_id: str
    request_type: RequestType
    client_ip: str
    session_token: str
    websocket: Any  # FastAPI WebSocket
    data: Dict[str, Any]  # Request-specific data
    timestamp: datetime
    priority: int = 1  # Higher priority = processed first (1=normal, 2=high, 3=critical)
    estimated_duration: float = 5.0  # Estimated processing time in seconds
    resource_usage: Dict[str, Any] = None  # Resource usage tracking


@dataclass
class PipelineResult:
    """Result of pipeline processing."""
    request_id: str
    success: bool
    transcript: Optional[str] = None
    llm_response: Optional[str] = None
    audio_data: Optional[bytes] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class UnifiedPipeline:
    """
    Unified pipeline for handling STT → LLM → TTS requests with proper resource management.
    """

    def __init__(
        self,
        transcriber: WhisperTranscriber,
        llm_client: LLMClient,
        tts_client: TTSClient,
        auth_service: AuthService,
        max_queue_size: int = 50,
        max_concurrent: int = 3,
        request_timeout: int = 30
    ):
        """
        Initialize the unified pipeline.

        Args:
            transcriber: Whisper transcription service
            llm_client: LLM client service
            tts_client: TTS client service
            auth_service: Authentication and rate limiting service
            max_queue_size: Maximum number of queued requests
            max_concurrent: Maximum concurrent processing requests
            request_timeout: Timeout for individual requests in seconds
        """
        self.transcriber = transcriber
        self.llm_client = llm_client
        self.tts_client = tts_client
        self.auth_service = auth_service

        self.max_queue_size = max_queue_size
        self.max_concurrent = max_concurrent
        self.request_timeout = request_timeout

        # Request queue and processing state
        self.request_queue: List[Tuple[int, int, PipelineRequest]] = []  # Priority queue: (priority, counter, request)
        self.request_queue_counter = 0  # For FIFO ordering within same priority
        self.request_queue_max_size = max_queue_size
        self.active_requests: Dict[str, PipelineRequest] = {}
        self.processing_semaphore = asyncio.Semaphore(max_concurrent)

        # Resource limits
        self.max_audio_size_mb = 10.0  # Maximum audio size in MB
        self.max_processing_time = 60.0  # Maximum processing time per request in seconds
        self.max_memory_usage_mb = 100.0  # Maximum memory usage per request in MB
        self.max_conversation_length = 100  # Maximum conversation history length
        self.max_request_rate_per_minute = 30  # Maximum requests per minute per client

        # Status tracking
        self.is_running = False
        self.stats = {
            "total_requests": 0,
            "completed_requests": 0,
            "failed_requests": 0,
            "queue_size": 0,
            "active_count": 0,
            "rejected_requests": 0,
            "avg_processing_time": 0.0,
            "resource_usage": {}
        }

        # Pipeline configuration
        self.system_prompt = self._load_system_prompt()
        self.user_profile = self._load_user_profile()

        logger.info(f"UnifiedPipeline initialized: max_queue={max_queue_size}, "
                   f"max_concurrent={max_concurrent}, timeout={request_timeout}s")

    def _queue_put(self, request: PipelineRequest):
        """Add request to priority queue."""
        # Use negative priority for min-heap (higher priority = smaller number)
        # Counter ensures FIFO ordering for same priority
        heapq.heappush(self.request_queue, (-request.priority, self.request_queue_counter, request))
        self.request_queue_counter += 1

    async def _queue_get(self) -> PipelineRequest:
        """Get next request from priority queue."""
        while True:
            if not self.request_queue:
                # Wait for items to be added
                await asyncio.sleep(0.1)
                continue

            priority, counter, request = heapq.heappop(self.request_queue)
            return request

    def _queue_size(self) -> int:
        """Get current queue size."""
        return len(self.request_queue)

    def _queue_full(self) -> bool:
        """Check if queue is full."""
        return self._queue_size() >= self.request_queue_max_size

    def _load_system_prompt(self) -> str:
        """Load system prompt (simplified version)."""
        try:
            import os
            prompt_path = os.path.join("prompts", "system_prompt.md")
            if os.path.exists(prompt_path):
                with open(prompt_path, "r") as f:
                    prompt = f.read().strip()
                    if prompt:
                        return prompt
        except Exception as e:
            logger.error(f"Error loading system prompt: {e}")

        # Default prompt
        return ("You are a helpful, friendly, and concise voice assistant. "
                "Respond to user queries in a natural, conversational manner. "
                "Keep responses brief and to the point, as you're communicating via voice.")

    def _load_user_profile(self) -> Dict[str, Any]:
        """Load user profile (simplified version)."""
        try:
            import os
            import json
            profile_path = os.path.join("prompts", "user_profile.json")
            if os.path.exists(profile_path):
                with open(profile_path, "r") as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")

        return {"name": "", "preferences": {}}

    async def start(self):
        """Start the pipeline processing loop."""
        if self.is_running:
            return

        self.is_running = True
        logger.info("Starting unified pipeline")

        # Start the processing loop
        asyncio.create_task(self._process_queue())

    async def stop(self):
        """Stop the pipeline processing."""
        self.is_running = False
        logger.info("Stopping unified pipeline")

    async def submit_request(
        self,
        request_type: RequestType,
        client_ip: str,
        session_token: str,
        websocket: Any,
        data: Dict[str, Any],
        priority: int = 1
    ) -> str:
        """
        Submit a request to the pipeline.

        Args:
            request_type: Type of request
            client_ip: Client IP address
            session_token: Session token for authentication
            websocket: WebSocket connection
            data: Request data
            priority: Request priority (higher = processed first)

        Returns:
            Request ID

        Raises:
            ValueError: If queue is full or validation fails
        """
        # Validate authentication
        is_valid, client_ip_or_error = self.auth_service.validate_session_token(session_token)
        if not is_valid:
            raise ValueError(f"Invalid session token: {client_ip_or_error}")

        # Check rate limits
        rate_allowed, retry_after = self.auth_service.check_rate_limit(client_ip)
        if not rate_allowed:
            raise ValueError(f"Rate limit exceeded. Retry after {retry_after:.1f} seconds|RATE_LIMIT_EXCEEDED")

        # Check concurrent limits
        if not self.auth_service.check_concurrent_limit(client_ip):
            raise ValueError("Too many concurrent requests|CONCURRENT_LIMIT_EXCEEDED")

        # Check queue size
        if self._queue_full():
            raise ValueError("Request queue is full|QUEUE_FULL")

        # Validate resource limits
        self._validate_resource_limits(data)

        # Set priority based on request type if not specified
        if priority == 1:  # Default priority
            if request_type == RequestType.GREETING:
                priority = 2  # Higher priority for greetings
            elif request_type == RequestType.SILENT_FOLLOWUP:
                priority = 3  # Critical priority for silent followups

        # Generate request ID
        request_id = f"{request_type.value}_{int(time.time() * 1000)}_{hash(session_token) % 1000}"

        # Estimate processing duration
        estimated_duration = self._estimate_processing_duration(request_type, data)

        # Create request
        request = PipelineRequest(
            request_id=request_id,
            request_type=request_type,
            client_ip=client_ip,
            session_token=session_token,
            websocket=websocket,
            data=data,
            timestamp=datetime.now(),
            priority=priority,
            estimated_duration=estimated_duration,
            resource_usage={}
        )

        # Increment concurrent counter
        self.auth_service.increment_concurrent(client_ip)

        # Add to priority queue
        self._queue_put(request)
        self.stats["total_requests"] += 1
        self.stats["queue_size"] = self._queue_size()

        # Send initial status
        await self._send_status_update(websocket, request_id, PipelineStage.QUEUED, {
            "queue_position": self.request_queue.qsize(),
            "estimated_wait": self._estimate_wait_time()
        })

        logger.info(f"Request {request_id} submitted to pipeline (type: {request_type.value}, queue: {self.request_queue.qsize()})")
        return request_id

    async def _process_queue(self):
        """Main processing loop for the pipeline."""
        while self.is_running:
            try:
                # Get next request from priority queue
                request = await self._queue_get()
                self.stats["queue_size"] = self._queue_size()

                # Process the request
                asyncio.create_task(self._process_request(request))

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in processing loop: {e}")
                await asyncio.sleep(1)  # Brief pause before continuing

    async def _process_request(self, request: PipelineRequest):
        """Process a single request through the pipeline with resource limits."""
        request_id = request.request_id
        websocket = request.websocket
        client_ip = request.client_ip

        try:
            # Add to active requests
            self.active_requests[request_id] = request
            self.stats["active_count"] = len(self.active_requests)

            # Acquire processing semaphore
            async with self.processing_semaphore:
                # Process with timeout
                try:
                    result = await asyncio.wait_for(
                        self._process_request_with_limits(request),
                        timeout=self.max_processing_time
                    )
                except asyncio.TimeoutError:
                    raise ValueError(f"Request processing timeout after {self.max_processing_time} seconds")

                # Send result to client
                await self._send_result(websocket, result)

                # Mark as completed
                self.stats["completed_requests"] += 1

        except Exception as e:
            logger.error(f"Error processing request {request_id}: {e}")

            # Create error result
            result = PipelineResult(
                request_id=request_id,
                success=False,
                error_message=str(e)
            )

            # Send error to client
            await self._send_result(websocket, result)
            self.stats["failed_requests"] += 1

        finally:
            # Cleanup
            if request_id in self.active_requests:
                del self.active_requests[request_id]
            self.stats["active_count"] = len(self.active_requests)

            # Decrement concurrent counter
            self.auth_service.decrement_concurrent(client_ip)

            # Mark queue task as done
            self.request_queue.task_done()

    async def _process_request_with_limits(self, request: PipelineRequest) -> PipelineResult:
        """Process request with resource monitoring."""
        # Check conversation length limit
        if len(self.llm_client.conversation_history) > self.max_conversation_length:
            # Trim conversation history to prevent memory issues
            keep_messages = self.max_conversation_length // 2
            self.llm_client.conversation_history = self.llm_client.conversation_history[-keep_messages:]
            logger.warning(f"Trimmed conversation history to {keep_messages} messages for request {request.request_id}")

        # Process based on request type
        if request.request_type == RequestType.GREETING:
            result = await self._process_greeting(request)
        elif request.request_type == RequestType.AUDIO:
            result = await self._process_audio(request)
        elif request.request_type == RequestType.SILENT_FOLLOWUP:
            result = await self._process_silent_followup(request)
        else:
            raise ValueError(f"Unknown request type: {request.request_type}")

        return result

    async def _process_greeting(self, request: PipelineRequest) -> PipelineResult:
        """Process a greeting request with partial updates."""
        websocket = request.websocket
        request_id = request.request_id

        # Update status
        await self._send_status_update(websocket, request_id, PipelineStage.PROCESSING_LLM)

        # Generate greeting prompt
        instruction = self._get_greeting_prompt()

        # Temporarily clear conversation history for greeting
        saved_history = self.llm_client.conversation_history.copy()
        self.llm_client.conversation_history = []

        try:
            # Get LLM response
            llm_response = self.llm_client.get_response(instruction, self.system_prompt, add_to_history=False, temperature=0.7)

            # Send partial LLM response
            await self._send_partial_llm_response(websocket, request_id, llm_response["text"], is_final=True)

            # Restore conversation history
            self.llm_client.conversation_history = saved_history

            # Initialize conversation context
            self._initialize_conversation_context()

            # Generate TTS
            await self._send_status_update(websocket, request_id, PipelineStage.GENERATING_SPEECH)
            audio_data = await self.tts_client.async_text_to_speech(llm_response["text"])

            return PipelineResult(
                request_id=request_id,
                success=True,
                transcript=None,  # Greeting has no transcript
                llm_response=llm_response["text"],
                audio_data=audio_data,
                metadata={"type": "greeting"}
            )

        except Exception as e:
            # Restore conversation history on error
            self.llm_client.conversation_history = saved_history
            raise

    async def _process_audio(self, request: PipelineRequest) -> PipelineResult:
        """Process an audio request through STT → LLM → TTS with partial updates."""
        websocket = request.websocket
        request_id = request.request_id
        audio_data = request.data.get("audio_bytes")

        if not audio_data:
            raise ValueError("No audio data provided|RESOURCE_LIMIT_EXCEEDED")

        # STT Stage
        await self._send_status_update(websocket, request_id, PipelineStage.TRANSCRIBING)

        # For partial transcription, we'll simulate streaming by sending intermediate results
        # In a real implementation, the transcriber would support streaming transcription
        transcript, stt_metadata = self.transcriber.transcribe(audio_data)

        # Send partial transcription (could be broken into chunks in real streaming)
        if transcript.strip():
            await self._send_partial_transcription(websocket, request_id, transcript, is_final=True)

        if not transcript.strip():
            # Empty transcript - still send completion signal
            return PipelineResult(
                request_id=request_id,
                success=True,
                transcript=transcript,
                llm_response=None,
                audio_data=None,
                metadata={"type": "audio", "empty_transcript": True}
            )

        # LLM Stage
        await self._send_status_update(websocket, request_id, PipelineStage.PROCESSING_LLM)

        # Check for vision context
        enhanced_transcript = transcript
        if hasattr(request, 'vision_context') and request.vision_context:
            enhanced_transcript = f"{transcript} [Note: This question refers to the image I just analyzed.]"
            # Add vision context to conversation
            self._add_vision_context_to_conversation(request.vision_context)

        # For partial LLM responses, we'll simulate streaming by sending chunks
        # In a real implementation, the LLM client would support streaming responses
        llm_response = self.llm_client.get_response(enhanced_transcript, self.system_prompt)

        # Send partial LLM response (could be streamed in real implementation)
        if llm_response["text"]:
            await self._send_partial_llm_response(websocket, request_id, llm_response["text"], is_final=True)

        # TTS Stage
        await self._send_status_update(websocket, request_id, PipelineStage.GENERATING_SPEECH)
        audio_data = await self.tts_client.async_text_to_speech(llm_response["text"])

        return PipelineResult(
            request_id=request_id,
            success=True,
            transcript=transcript,
            llm_response=llm_response["text"],
            audio_data=audio_data,
            metadata={
                "type": "audio",
                "stt_metadata": stt_metadata,
                "llm_metadata": {k: v for k, v in llm_response.items() if k != "text"}
            }
        )

    async def _process_silent_followup(self, request: PipelineRequest) -> PipelineResult:
        """Process a silent follow-up request with partial updates."""
        websocket = request.websocket
        request_id = request.request_id
        tier = request.data.get("tier", 0)

        # Update status
        await self._send_status_update(websocket, request_id, PipelineStage.PROCESSING_LLM)

        # Get appropriate silence indicator
        user_input = self._get_silence_indicator(tier)

        # Get LLM response with context
        llm_response = self.llm_client.get_response(user_input, self.system_prompt, add_to_history=False, temperature=0.7)

        # Send partial LLM response
        await self._send_partial_llm_response(websocket, request_id, llm_response["text"], is_final=True)

        # Generate TTS
        await self._send_status_update(websocket, request_id, PipelineStage.GENERATING_SPEECH)
        audio_data = await self.tts_client.async_text_to_speech(llm_response["text"])

        return PipelineResult(
            request_id=request_id,
            success=True,
            transcript=None,
            llm_response=llm_response["text"],
            audio_data=audio_data,
            metadata={"type": "silent_followup", "tier": tier}
        )

    def _get_greeting_prompt(self) -> str:
        """Get greeting prompt based on user profile."""
        user_name = self.user_profile.get("name", "")
        has_history = len(self.llm_client.conversation_history) > 0

        if user_name:
            if has_history:
                return f"Create a friendly greeting for {user_name} who just activated their microphone. Be brief and conversational, but treat it like you've met them before. Do not do anything else."
            else:
                return f"Create a friendly greeting for {user_name} who just activated their microphone. Be brief and conversational, but treat it like you're meeting them for the first time. Do not do anything else."
        else:
            if has_history:
                return "Create a friendly greeting for someone who just activated their microphone. Be brief and conversational, but treat it like you've met them before. Do not do anything else."
            else:
                return "Create a friendly greeting for someone who just activated their microphone. Be brief and conversational, but treat it like you're meeting them for the first time. Do not do anything else."

    def _get_silence_indicator(self, tier: int) -> str:
        """Get silence indicator based on tier."""
        indicators = ["[silent]", "[no response]", "[still waiting]"]
        return indicators[min(tier, len(indicators) - 1)]

    def _initialize_conversation_context(self):
        """Initialize conversation context with user information."""
        user_name = self.user_profile.get("name", "")
        if not user_name:
            return

        context_message = {
            "role": "system",
            "content": f"USER CONTEXT: The user's name is {user_name}."
        }

        # Insert after main system prompt if it exists
        if (self.llm_client.conversation_history and
            self.llm_client.conversation_history[0]["role"] == "system"):
            if (len(self.llm_client.conversation_history) > 1 and
                "USER CONTEXT" in self.llm_client.conversation_history[1].get("content", "")):
                # Replace existing context
                self.llm_client.conversation_history[1] = context_message
            else:
                # Insert after system prompt
                self.llm_client.conversation_history.insert(1, context_message)
        else:
            # Add as first message
            self.llm_client.conversation_history.insert(0, context_message)

    def _add_vision_context_to_conversation(self, vision_context: str):
        """Add vision context to conversation history."""
        vision_message = {
            "role": "system",
            "content": f"[VISION CONTEXT]: {vision_context}"
        }

        # Find last system message that's not vision context
        last_system_idx = -1
        for i, msg in enumerate(self.llm_client.conversation_history):
            if msg["role"] == "system" and not msg["content"].startswith("[VISION CONTEXT]"):
                last_system_idx = i

        if last_system_idx >= 0:
            self.llm_client.conversation_history.insert(last_system_idx + 1, vision_message)
        else:
            self.llm_client.conversation_history.insert(0, vision_message)

    async def _send_status_update(self, websocket: Any, request_id: str, stage: PipelineStage, data: Optional[Dict[str, Any]] = None):
        """Send status update to client."""
        try:
            await websocket.send_json({
                "type": "pipeline_status",
                "request_id": request_id,
                "status": stage.value,
                "timestamp": datetime.now().isoformat(),
                "data": data or {},
                "version": "1.0"
            })
        except Exception as e:
            logger.error(f"Failed to send status update: {e}")

    async def _send_partial_transcription(self, websocket: Any, request_id: str, partial_text: str, is_final: bool = False):
        """Send partial transcription result."""
        try:
            await websocket.send_json({
                "type": "transcription_partial" if not is_final else "transcription",
                "request_id": request_id,
                "text": partial_text,
                "is_final": is_final,
                "timestamp": datetime.now().isoformat(),
                "version": "1.0"
            })
        except Exception as e:
            logger.error(f"Failed to send partial transcription: {e}")

    async def _send_partial_llm_response(self, websocket: Any, request_id: str, partial_text: str, is_final: bool = False):
        """Send partial LLM response."""
        try:
            await websocket.send_json({
                "type": "llm_response_partial" if not is_final else "llm_response",
                "request_id": request_id,
                "text": partial_text,
                "is_final": is_final,
                "timestamp": datetime.now().isoformat(),
                "version": "1.0"
            })
        except Exception as e:
            logger.error(f"Failed to send partial LLM response: {e}")

    async def _send_result(self, websocket: Any, result: PipelineResult):
        """Send processing result to client in the expected message format."""
        try:
            if not result.success:
                # Send error message
                await websocket.send_json({
                    "type": "error",
                    "request_id": result.request_id,
                    "error": result.error_message or "Unknown error",
                    "code": "PROCESSING_FAILED",
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })
                return

            # Send results in the standardized format
            if result.transcript is not None:
                # Send final transcription result
                await websocket.send_json({
                    "type": "transcription",
                    "request_id": result.request_id,
                    "text": result.transcript,
                    "metadata": result.metadata.get("stt_metadata", {}) if result.metadata else {},
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })

            if result.llm_response:
                # Send final LLM response
                await websocket.send_json({
                    "type": "llm_response",
                    "request_id": result.request_id,
                    "text": result.llm_response,
                    "metadata": result.metadata.get("llm_metadata", {}) if result.metadata else {},
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })

            if result.audio_data:
                # Send TTS audio in the standardized format
                import base64
                await websocket.send_json({
                    "type": "tts_start",
                    "request_id": result.request_id,
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })

                # Send the audio chunk
                encoded_audio = base64.b64encode(result.audio_data).decode("utf-8")
                await websocket.send_json({
                    "type": "tts_chunk",
                    "request_id": result.request_id,
                    "audio_chunk": encoded_audio,
                    "format": self.tts_client.output_format,
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })

                # Send TTS end
                await websocket.send_json({
                    "type": "tts_end",
                    "request_id": result.request_id,
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0"
                })

        except Exception as e:
            logger.error(f"Failed to send result: {e}")

    def _estimate_wait_time(self) -> float:
        """Estimate wait time for queued requests."""
        queue_size = self._queue_size()
        active_count = len(self.active_requests)

        if queue_size == 0:
            return 0.0

        # Calculate weighted average processing time based on queue contents
        total_weighted_time = 0.0
        total_weight = 0.0

        for priority, counter, request in self.request_queue:
            weight = 1.0 / (2 ** abs(priority))  # Higher priority = higher weight
            total_weighted_time += request.estimated_duration * weight
            total_weight += weight

        avg_processing_time = total_weighted_time / total_weight if total_weight > 0 else 5.0

        # Estimate based on queue position and current active requests
        return (queue_size + active_count) * avg_processing_time

    def _validate_resource_limits(self, data: Dict[str, Any]):
        """Validate resource limits for request data."""
        # Check audio size limit
        if "audio_bytes" in data:
            audio_size_mb = len(data["audio_bytes"]) / (1024 * 1024)
            if audio_size_mb > self.max_audio_size_mb:
                raise ValueError(f"Audio size {audio_size_mb:.1f}MB exceeds limit of {self.max_audio_size_mb}MB")

            # Check for minimum audio size (too small audio might be invalid)
            if audio_size_mb < 0.001:  # Less than 1KB
                raise ValueError("Audio data is too small, possibly corrupted")

        # Check for malicious payloads (very large data)
        total_data_size = sum(len(str(v)) for v in data.values() if isinstance(v, (str, bytes)))
        if total_data_size > 50 * 1024 * 1024:  # 50MB total
            raise ValueError("Request payload too large")

    def _estimate_processing_duration(self, request_type: RequestType, data: Dict[str, Any]) -> float:
        """Estimate processing duration for request."""
        base_times = {
            RequestType.GREETING: 3.0,  # Quick LLM generation
            RequestType.AUDIO: 8.0,     # STT + LLM + TTS
            RequestType.SILENT_FOLLOWUP: 4.0  # LLM + TTS
        }

        duration = base_times.get(request_type, 5.0)

        # Adjust for audio size if present
        if "audio_bytes" in data:
            audio_size_mb = len(data["audio_bytes"]) / (1024 * 1024)
            # Add time based on audio size (rough estimate)
            duration += min(audio_size_mb * 0.5, 5.0)  # Max 5s extra for large audio

        return duration

    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics."""
        return {
            **self.stats,
            "queue_size": self._queue_size(),
            "active_requests": list(self.active_requests.keys()),
            "is_running": self.is_running
        }
