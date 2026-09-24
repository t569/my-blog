#!/usr/bin/env python3
"""Generate a test JWT for local development.

Usage:
    python scripts/generate_token.py

Outputs a valid JWT that can be used in the Authorization header:
    Authorization: Bearer <token>

Requires NEXTAUTH_SECRET to be set in your .env file.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

# Python puts *this file's* directory on sys.path, not the one it was run from,
# so `python scripts/generate_token.py` could never import `app` — the usage
# line above was wrong from the start. Add the repo root ourselves.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Load settings — this requires the .env file to be present.
from app.config import settings  # noqa: E402

EXPIRY_HOURS = 24


def main() -> None:
    payload = {
        "email": "admin@d3jusdevspace.com",
        "sub": "admin@d3jusdevspace.com",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRY_HOURS),
    }

    token = jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm="HS256")

    print("\n--- d3jusdevspace Test JWT ---")
    print(f"Email:   {payload['email']}")
    print(f"Expires: {payload['exp'].isoformat()}")
    print(f"\nToken:\n{token}")
    print(f"\ncurl header:")
    print(f'  -H "Authorization: Bearer {token}"')
    print()


if __name__ == "__main__":
    main()
