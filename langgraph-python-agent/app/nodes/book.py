from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from typing import Any

from app.core.state import State
from app.tools.ghl_client import GhlClient


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

