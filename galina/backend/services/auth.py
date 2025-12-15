"""
WebSocket Authentication and Rate Limiting Service

Handles authentication tokens and rate limiting for WebSocket connections.
"""

import time
import hashlib
import secrets
from typing import Dict, Optional, Tuple
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


class AuthService:
    """
    Service for handling WebSocket authentication and rate limiting.
    """

    def __init__(self, auth_enabled: bool = False, auth_token: str = "",
                 rate_limit_requests: int = 10, rate_limit_window: int = 60,
                 max_concurrent: int = 5):
        """
        Initialize the authentication service.

        Args:
            auth_enabled: Whether authentication is enabled
            auth_token: The authentication token to validate against
            rate_limit_requests: Number of requests allowed per time window
            rate_limit_window: Time window in seconds for rate limiting
            max_concurrent: Maximum number of concurrent requests per client
        """
        self.auth_enabled = auth_enabled
        self.auth_token = auth_token
        self.rate_limit_requests = rate_limit_requests
        self.rate_limit_window = rate_limit_window
        self.max_concurrent = max_concurrent

        # Rate limiting storage: client_ip -> deque of timestamps
        self.rate_limit_store: Dict[str, deque] = defaultdict(deque)

        # Concurrent requests tracking: client_ip -> count
        self.concurrent_requests: Dict[str, int] = defaultdict(int)

        # Session tokens for authenticated clients
        self.session_tokens: Dict[str, Dict] = {}

        logger.info(f"AuthService initialized: auth_enabled={auth_enabled}, "
                   f"rate_limit={rate_limit_requests}/{rate_limit_window}s, "
                   f"max_concurrent={max_concurrent}")

    def authenticate(self, token: str, client_ip: str) -> Tuple[bool, str]:
        """
        Authenticate a client token.

        Args:
            token: The token to validate
            client_ip: Client IP address

        Returns:
            Tuple of (success, session_token_or_error_message)
        """
        if not self.auth_enabled:
            # Generate a session token for tracking even if auth is disabled
            session_token = self._generate_session_token(client_ip)
            return True, session_token

        if not token:
            return False, "Authentication token required"

        if token != self.auth_token:
            return False, "Invalid authentication token"

        # Generate session token for this authenticated client
        session_token = self._generate_session_token(client_ip)
        return True, session_token

    def check_rate_limit(self, client_ip: str) -> Tuple[bool, Optional[float]]:
        """
        Check if client is within rate limits.

        Args:
            client_ip: Client IP address

        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        now = time.time()
        request_times = self.rate_limit_store[client_ip]

        # Remove old requests outside the time window
        while request_times and request_times[0] < now - self.rate_limit_window:
            request_times.popleft()

        # Check if under limit
        if len(request_times) >= self.rate_limit_requests:
            # Calculate when the oldest request will expire
            oldest_request = request_times[0]
            retry_after = (oldest_request + self.rate_limit_window) - now
            return False, retry_after

        # Add current request
        request_times.append(now)
        return True, None

    def check_concurrent_limit(self, client_ip: str) -> bool:
        """
        Check if client is within concurrent request limits.

        Args:
            client_ip: Client IP address

        Returns:
            True if allowed, False if limit exceeded
        """
        return self.concurrent_requests[client_ip] < self.max_concurrent

    def increment_concurrent(self, client_ip: str):
        """
        Increment concurrent request count for client.

        Args:
            client_ip: Client IP address
        """
        self.concurrent_requests[client_ip] += 1

    def decrement_concurrent(self, client_ip: str):
        """
        Decrement concurrent request count for client.

        Args:
            client_ip: Client IP address
        """
        if client_ip in self.concurrent_requests:
            self.concurrent_requests[client_ip] = max(0, self.concurrent_requests[client_ip] - 1)

    def validate_session_token(self, session_token: str) -> Tuple[bool, Optional[str]]:
        """
        Validate a session token and return associated client info.

        Args:
            session_token: The session token to validate

        Returns:
            Tuple of (valid, client_ip_or_none)
        """
        if session_token in self.session_tokens:
            session_data = self.session_tokens[session_token]
            # Check if session hasn't expired (24 hours)
            if time.time() - session_data.get('created_at', 0) < 86400:
                return True, session_data.get('client_ip')
            else:
                # Remove expired session
                del self.session_tokens[session_token]

        return False, None

    def _generate_session_token(self, client_ip: str) -> str:
        """
        Generate a unique session token for the client.

        Args:
            client_ip: Client IP address

        Returns:
            Session token string
        """
        # Create a unique token based on IP, timestamp, and random salt
        token_data = f"{client_ip}:{time.time()}:{secrets.token_hex(16)}"
        token_hash = hashlib.sha256(token_data.encode()).hexdigest()[:32]

        # Store session info
        self.session_tokens[token_hash] = {
            'client_ip': client_ip,
            'created_at': time.time()
        }

        return token_hash

    def cleanup_expired_sessions(self):
        """
        Clean up expired session tokens.
        """
        now = time.time()
        expired_tokens = []

        for token, session_data in self.session_tokens.items():
            if now - session_data.get('created_at', 0) >= 86400:  # 24 hours
                expired_tokens.append(token)

        for token in expired_tokens:
            del self.session_tokens[token]

        if expired_tokens:
            logger.info(f"Cleaned up {len(expired_tokens)} expired session tokens")