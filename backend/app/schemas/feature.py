"""Feature toggle schemas."""

from pydantic import BaseModel, Field


class FeatureState(BaseModel):
    id: str
    label: str
    description: str
    covers: list[str]
    fallback: str
    #: Credentials are present — the switch may be operated.
    available: bool
    #: The owner's switch. Independent of ``available``, so turning credentials
    #: on later restores the choice that was made rather than defaulting it.
    enabled: bool
    #: Env vars that are unset, named so the UI can say what to add.
    missing: list[str]


class FeatureUpdate(BaseModel):
    """Partial {feature_id: enabled} update — omitted features are untouched."""

    features: dict[str, bool] = Field(default_factory=dict)
