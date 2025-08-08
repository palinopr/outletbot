from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage

from app.core.state import State
from ._utils import to_text, parse_json


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
    content_text = to_text(res.content)
    data = parse_json(content_text)
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

