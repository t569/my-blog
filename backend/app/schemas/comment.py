"""Comment request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    """Request body for submitting a comment.

    The ``honeypot`` field must be empty — any value indicates a bot.
    """

    post_id: uuid.UUID
    display_name: str | None = Field(None, min_length=1, max_length=50)
    body: str = Field(..., min_length=1, max_length=1000)
    honeypot: str = Field(default="", max_length=0)


class CommentResponse(BaseModel):
    """Comment data returned to clients."""

    id: uuid.UUID
    post_id: uuid.UUID
    display_name: str | None
    body: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SuggestionCreate(BaseModel):
    """A reader's suggested edit, sent through a preview link.

    ``quote`` is the passage it is about (empty for a general note). The
    ``honeypot`` must be empty, as for comments.
    """

    display_name: str = Field(..., min_length=1, max_length=50)
    quote: str = Field(default="", max_length=1000)
    body: str = Field(..., min_length=1, max_length=4000)
    honeypot: str = Field(default="", max_length=0)
