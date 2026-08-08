"""Authentication dependencies for admin route protection.

Validates JWTs issued by NextAuth.js (HS256 signed with NEXTAUTH_SECRET).
"""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import get_db
from app.models.owner import Owner

_bearer_scheme = HTTPBearer()


async def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Owner:
    """Decode and validate a NextAuth JWT, then return the owner record.

    Raises ``HTTPException(401)`` if the token is invalid, expired,
    or does not correspond to a registered owner.
    """
    # Fail closed: an empty secret would make jwt.decode verify against an
    # empty HMAC key, so anyone could mint a valid admin token. No secret
    # means no admin access at all, not open access.
    if not settings.NEXTAUTH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication is not configured.",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.NEXTAUTH_SECRET,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    email: str | None = payload.get("email")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing email claim.",
        )

    result = await db.execute(select(Owner).where(Owner.email == email))
    owner = result.scalar_one_or_none()

    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Owner not found.",
        )

    return owner
