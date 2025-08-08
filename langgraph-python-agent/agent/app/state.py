from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class CRM(BaseModel):
    tags: List[str] = Field(default_factory=list)
    stage: Optional[str] = None
    location_id: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class NLP(BaseModel):
    language: Optional[Literal["es", "en"]] = None
    intent: Optional[Literal["qualify", "price", "book", "info", "out_of_scope"]] = None
    priority: Optional[int] = None
    sentiment: Optional[Literal["pos", "neu", "neg"]] = None


class Planner(BaseModel):
    next_action: Optional[Literal["tag", "respond", "book", "note", "done"]] = None
    rationale: Optional[str] = None


class Booking(BaseModel):
    proposed_slots: List[str] = Field(default_factory=list)
    selected_slot: Optional[str] = None
    appointment_id: Optional[str] = None


class Turn(BaseModel):
    role: Literal["user", "assistant", "tool"]
    content: str


class State(BaseModel):
    contact_id: str
    conversation_id: Optional[str] = None
    latest_text: Optional[str] = None
    channel: Optional[Literal["sms", "facebook", "instagram"]] = None

    crm: CRM = CRM()
    nlp: NLP = NLP()
    planner: Planner = Planner()
    booking: Booking = Booking()

    history: List[Turn] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)
