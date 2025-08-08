from __future__ import annotations

from app.core.state import State
from app.tools.ghl_client import GhlClient


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
        pass
    state.planner.next_action = "done"
    return state

