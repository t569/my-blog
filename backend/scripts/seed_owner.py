#!/usr/bin/env python3
"""Seed the single owner row for v1.

Usage:
    python scripts/seed_owner.py

Idempotent — does nothing if the owner already exists.
"""

import asyncio

from sqlalchemy import select

from app.config import settings
from app.db.base import async_session_factory
from app.models.owner import Owner

ADMIN_EMAIL = settings.ADMIN_EMAIL


async def seed() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Owner).where(Owner.email == ADMIN_EMAIL)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Owner already exists: {existing.email} (id={existing.id})")
            return

        owner = Owner(email=ADMIN_EMAIL)
        session.add(owner)
        await session.commit()
        await session.refresh(owner)
        print(f"Created owner: {owner.email} (id={owner.id})")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
