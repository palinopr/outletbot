from __future__ import annotations

from app.core.state import State


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

