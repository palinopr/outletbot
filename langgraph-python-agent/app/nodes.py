from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .ghl_client import GhlClient
from .state import State


def _to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict):
                t = c.get("text")
                if isinstance(t, str):
                    parts.append(t)
        return "\n".join(parts)
    return str(content)


def _parse_json(text: str) -> Any:
    """Best-effort JSON extractor (strips code fences and trailing text)."""
    s = text.strip()
    if s.startswith("```"):
        # remove code fences
        s = s.strip("`")
        # after stripping backticks, try to find first { and last }
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        s = s[start : end + 1]
    try:
        return json.loads(s)
    except Exception:
        return None


async def fetch_crm(state: State, ghl: GhlClient) -> State:
    """Fetch contact + tags; keep minimal facts in state."""
    try:
        contact = await ghl.get_contact(state.contact_id)
        if contact:
            # Tags shape can vary; normalize to names if present
            # e.g., {"tags":[{"name":"Spanish"}, ...]}
            tags = []
            for t in contact.get("tags", []):
                if isinstance(t, dict) and "name" in t:
                    tags.append(t["name"])
                elif isinstance(t, str):
                    tags.append(t)
            state.crm.tags = tags or state.crm.tags
            # Location is commonly set by env; leave as-is if set
            if not state.crm.location_id:
                state.crm.location_id = os.getenv("GHL_LOCATION_ID")
    except Exception:
        # Non-fatal; continue without CRM enrichment
        pass
    return state


async def classify(state: State, llm: Any) -> State:
    """Classify language, intent, priority, sentiment using a small model with JSON output."""
    # Offline fallback if no LLM configured
    if llm is None:
        msg = (state.latest_text or "").lower()
        state.nlp.language = "es" if any(x in msg for x in ["hola", "precio", "agendar"]) else "en"
        state.nlp.intent = "book" if ("book" in msg or "agendar" in msg) else "qualify"
        state.nlp.priority = 3
        state.nlp.sentiment = "neu"
        return state
    prompt = (
        "You are a classifier. Read the user's last message and return ONLY a compact JSON object "
        'with keys: "language" (one of "es"|"en"), "intent" (one of "qualify"|"price"|"book"|"info"|"out_of_scope"), '
        '"priority" (1-5), "sentiment" ("pos"|"neu"|"neg"). No extra text.\n\n'
        f'last_message: "{state.latest_text or ""}"'
    )
    res = await llm.ainvoke([HumanMessage(content=prompt)])
    content_text = _to_text(res.content)
    data = _parse_json(content_text)
    if isinstance(data, dict):
        lang = str(data.get("language", "")).lower()
        state.nlp.language = "es" if lang.startswith("es") else "en"
        intent = str(data.get("intent", "")).lower()
        if intent in {"qualify", "price", "book", "info", "out_of_scope"}:
            state.nlp.intent = intent  # type: ignore
        else:
            state.nlp.intent = "qualify"
        try:
            prio = int(data.get("priority", 3))
            state.nlp.priority = max(1, min(5, prio))
        except Exception:
            state.nlp.priority = 3
        sent = str(data.get("sentiment", "neu")).lower()
        state.nlp.sentiment = "pos" if sent.startswith("p") else ("neg" if sent.startswith("n") else "neu")
    else:
        # fallback defaults
        state.nlp.language = "es" if any(x in (state.latest_text or "").lower() for x in ["hola", "precio", "agendar"]) else "en"
        state.nlp.intent = "book" if "book" in (state.latest_text or "").lower() else "qualify"
        state.nlp.priority = 3
        state.nlp.sentiment = "neu"
    return state


def plan(state: State) -> State:
    """Deterministic router based on classified intent."""
    intent = state.nlp.intent or "qualify"
    if intent == "book":
        state.planner.next_action = "book"
    elif intent in {"price", "qualify", "info"}:
        state.planner.next_action = "respond"
    elif intent == "out_of_scope":
        state.planner.next_action = "tag"
    else:
        state.planner.next_action = "respond"
    state.planner.rationale = f"routed_by_intent:{intent}"
    return state


async def tag(state: State, ghl: GhlClient) -> State:
    """Assign helpful tags to contact (language + intent)."""
    tags = set(state.crm.tags)
    if state.nlp.language:
        tags.add("Spanish" if state.nlp.language == "es" else "English")
    if state.nlp.intent:
        tags.add(f"intent:{state.nlp.intent}")
    try:
        await ghl.assign_tags(state.contact_id, sorted(list(tags)))
        state.crm.tags = sorted(list(tags))
    except Exception:
        # non-fatal
        pass
    state.planner.next_action = "done"
    return state


async def respond(state: State, llm: Any, ghl: GhlClient) -> State:
    """Draft a bilingual response and send via GHL."""
    # Offline fallback if no LLM configured
    if llm is None:
        if state.nlp.language == "es":
            text = ("¡Gracias por tu mensaje! Para ayudarte mejor: ¿buscas más ventas, más clientes o lanzar algo nuevo? "
                    "Puedo proponerte opciones y agendar una llamada. ¿Tienes un presupuesto mensual o prefieres una sugerencia?")
        else:
            text = ("Thanks for reaching out! To help you better: are you aiming for more sales, more leads, or launching something new? "
                    "I can suggest options and book a quick call. Do you have a monthly budget or would you like a recommendation?")
        try:
            await ghl.send_message(state.contact_id, text, state.channel or "sms")
        except Exception:
            pass
        state.history.append({"role": "assistant", "content": text})  # type: ignore
        state.planner.next_action = "done"
        return state
    if state.nlp.language == "es":
        sys = "Eres un asistente de agencia. Sé claro, profesional y cercano. Prioriza agendar llamada."
        user = (
            f"Mensaje del cliente: {state.latest_text}\n"
            "Redacta una respuesta breve y empática en español. Pregunta su meta (ventas, clientes o lanzamiento), "
            "ofrece agendar una llamada y pregunta si tiene un presupuesto mensual o si prefiere una sugerencia."
        )
    else:
        sys = "You are an agency assistant. Be clear, professional, friendly. Prioritize booking a call."
        user = (
            f"User message: {state.latest_text}\n"
            "Write a brief, empathetic reply in English. Ask their main goal (sales, leads, or launch), "
            "offer to book a quick call, and ask if they have a monthly budget or prefer a suggestion."
        )
    res = await llm.ainvoke([SystemMessage(content=sys), HumanMessage(content=user)])
    text = _to_text(res.content)
    try:
        await ghl.send_message(state.contact_id, text, state.channel or "sms")
    except Exception:
        # non-fatal; still finish
        pass
    state.history.append({"role": "assistant", "content": text})  # type: ignore
    state.planner.next_action = "done"
    return state


async def book(state: State, ghl: GhlClient, llm: Any) -> State:
    """Propose a near-term slot and create an appointment."""
    # Pick first calendar in location
    location_id = state.crm.location_id or os.getenv("GHL_LOCATION_ID") or ""
    cal_id = None
    try:
        cals = await ghl.list_calendars(location_id)
        data = cals.get("data") if isinstance(cals, dict) else None
        if isinstance(data, list) and data:
            cal_id = data[0].get("id")
    except Exception:
        cal_id = None

    # Simple slot: tomorrow at 3pm UTC (placeholder; replace with TZ-aware logic)
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    slot = tomorrow.replace(hour=15, minute=0, second=0, microsecond=0).isoformat()

    appt_id = None
    if cal_id:
        try:
            appt = await ghl.create_appointment(str(cal_id), state.contact_id, slot)
            appt_id = appt.get("id") if isinstance(appt, dict) else None
        except Exception:
            appt_id = None

    state.booking.selected_slot = slot
    state.booking.appointment_id = appt_id

    if state.nlp.language == "es":
        msg = (
            "Puedo agendar una llamada. Propongo mañana a las 3:00 pm. "
            "Si no te funciona, dime un horario alternativo y lo ajustamos."
        )
        if appt_id:
            msg = f"Listo, agendé una llamada para mañana a las 3:00 pm (ID {appt_id}). ¿Te funciona?"
    else:
        msg = (
            "I can schedule a quick call. I propose tomorrow at 3:00 pm. "
            "If that doesn't work, share a time and I'll adjust."
        )
        if appt_id:
            msg = f"Booked a call for tomorrow at 3:00 pm (ID {appt_id}). Does that work?"

    try:
        await ghl.send_message(state.contact_id, msg, state.channel or "sms")
    except Exception:
        pass

    state.planner.next_action = "done"
    return state
