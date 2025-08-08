from __future__ import annotations

import os
from typing import Any

from app.core.state import State
from app.tools.ghl_client import GhlClient


async def fetch_crm(state: State, ghl: GhlClient) -> State:
    """Fetch contact + tags; keep minimal facts in state."""
    try:
        contact = await ghl.get_contact(state.contact_id)
        if contact:
            # Tags shape can vary; normalize to names if present
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

