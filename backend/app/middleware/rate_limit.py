"""IP-based rate limiting middleware for comment submissions.

Uses an in-memory store. For production with multiple workers, replace
with a Redis-backed implementation.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


def client_ip(request: Request) -> str:
    """The caller's address, as the proxy chain reports it.

    Behind the Next.js proxy on Vercel, ``request.client.host`` is Vercel's
    egress address for every visitor, which turns a per-IP limit into one
    shared bucket. The platform puts the real client first in
    ``X-Forwarded-For``, so that is used when present.

    It is not proof of identity: anyone calling the backend directly can set the
    header. Limits keyed on it are best-effort, and anything protecting spend
    should also have a global ceiling (see ``RateLimiter.check(key=...)``).
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """Track request counts per IP within a rolling time window."""

    def __init__(
        self,
        max_requests: int = 3,
        window_seconds: int = 3600,
        detail: str = "Too many comments. Please try again later.",
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.detail = detail
        # Mapping of IP → list of request timestamps.
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _clean_old_entries(self, ip: str) -> None:
        """Remove timestamps outside the current window."""
        cutoff = time.time() - self.window_seconds
        self._requests[ip] = [
            t for t in self._requests[ip] if t > cutoff
        ]

    def check(self, request: Request, key: str | None = None) -> None:
        """Raise ``HTTPException(429)`` if the caller has exceeded the limit.

        ``key`` overrides the per-IP key; pass a constant for a limit shared by
        everyone.
        """
        ip = key if key is not None else client_ip(request)
        self._clean_old_entries(ip)

        if len(self._requests[ip]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=self.detail,
            )

        self._requests[ip].append(time.time())


# Singleton instance — 3 comments per IP per hour.
comment_rate_limiter = RateLimiter(max_requests=3, window_seconds=3600)
