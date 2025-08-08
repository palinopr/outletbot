from __future__ import annotations

import os
from typing import Any, Dict, Optional, Literal

from fastapi import FastAPI, HTTPException, Request

from app.graph.graph import build_graph
from app.core.state import State

app = FastAPI(title="GHL LangGraph Agent")

# Build the compiled graph lazily to allow server start without provider keys set
_graph = None

def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def _extract_payload(body: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Normalize common Go High Level (LeadConnector) webhook shapes to our State fields.
    This is a best-effort mapper; adjust keys to your exact webhook configuration.
    """
    contact_id = (
        body.get("contactId")
        or (body.get("contact") or {}).get("id")
        or (body.get("data") or {}).get("contactId")
    )
    text = (
        (body.get("message") or {}).get("text")
        or body.get("body")
        or (body.get("data") or {}).get("body")
    )
    channel = body.get("channel") or (body.get("data") or {}).get("channel") or "sms"
    conversation_id = (
        body.get("conversationId")
        or (body.get("conversation") or {}).get("id")
        or (body.get("data") or {}).get("conversationId")
    )
    return {
        "contact_id": contact_id,
        "latest_text": text,
        "channel": channel,
        "conversation_id": conversation_id,
    }


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/webhooks/ghl")
async def handle_ghl(req: Request):
    try:
        body = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    fields = _extract_payload(body or {})
    contact_id = fields["contact_id"]
    latest_text = fields["latest_text"]
    channel = fields["channel"]
    conversation_id = fields["conversation_id"]

    # Normalize channel to allowed literals
    channel_map: dict[str, Literal["sms", "facebook", "instagram"]] = {
        "sms": "sms",
        "facebook": "facebook",
        "fb": "facebook",
        "instagram": "instagram",
        "ig": "instagram",
    }
    chan: Optional[Literal["sms", "facebook", "instagram"]] = (
        channel_map.get(str(channel).lower()) if channel else "sms"
    )

    if not contact_id:
        raise HTTPException(status_code=400, detail="Missing contact_id")
    if not latest_text:
        # Some webhook events may not carry text; allow but no-op routing
        latest_text = ""

    state = State(
        contact_id=str(contact_id),
        latest_text=str(latest_text),
        channel=chan,
        conversation_id=str(conversation_id) if conversation_id else None,
    )

    # Use contact_id as thread key to preserve memory/checkpointing
    graph = get_graph()
    raw = await graph.ainvoke(
        state,
        config={
            "configurable": {"thread_id": str(contact_id)},
            "tags": [f"channel:{(chan or 'sms')}"],
            "metadata": {"contact_id": str(contact_id)},
        },
    )
    result: State = State.model_validate(raw) if isinstance(raw, dict) else raw

    return {
        "status": "ok",
        "next_action": result.planner.next_action,
        "language": result.nlp.language,
        "intent": result.nlp.intent,
        "appointment_id": result.booking.appointment_id,
    }
