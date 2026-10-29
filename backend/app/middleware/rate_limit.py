"""IP-based rate limiting middleware for comment submissions.

Uses an in-memory store. For production with multiple workers, replace
with a Redis-backed implementation.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Track request counts per IP within a rolling time window."""

    def __init__(self, max_requests: int = 3, window_seconds: int = 3600) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Mapping of IP → list of request timestamps.
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _clean_old_entries(self, ip: str) -> None:
        """Remove timestamps outside the current window."""
        cutoff = time.time() - self.window_seconds
        self._requests[ip] = [
            t for t in self._requests[ip] if t > cutoff
        ]

    def check(self, request: Request) -> None:
        """Raise ``HTTPException(429)`` if the IP has exceeded the limit."""
        ip = request.client.host if request.client else "unknown"
        self._clean_old_entries(ip)

        if len(self._requests[ip]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many comments. Please try again later.",
            )

        self._requests[ip].append(time.time())


# Singleton instance — 3 comments per IP per hour.
comment_rate_limiter = RateLimiter(max_requests=3, window_seconds=3600)

# A reviewer leaves several notes in one sitting; still caps a leaked link.
suggestion_rate_limiter = RateLimiter(max_requests=20, window_seconds=3600)
