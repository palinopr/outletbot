from __future__ import annotations

import os
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI

from app.core.state import State
from app.tools.ghl_client import GhlClient
from app.nodes import fetch_crm, classify, plan, tag, respond, book


def build_graph() -> Any:
    """
    Build and compile the LangGraph for the GHL agent.

    Returns a compiled graph (callable). Use .invoke / .ainvoke with a State instance and
    config={"configurable": {"thread_id": "<contact_id>"}} to preserve conversation memory.
    """
    # Models (configurable via env)
    model_classify = os.getenv("MODEL_CLASSIFY", "gpt-4o-mini")
    model_respond = os.getenv("MODEL_RESPOND", "gpt-4o")

    # Build LLMs only if OPENAI_API_KEY is set; otherwise run with offline fallbacks
    if os.getenv("OPENAI_API_KEY"):
        llm_small = ChatOpenAI(model=model_classify, temperature=0.2)
        llm_big = ChatOpenAI(model=model_respond, temperature=0.5)
    else:
        llm_small = None  # type: ignore
        llm_big = None  # type: ignore

    # Tools
    ghl = GhlClient()

    # Graph definition
    graph = StateGraph(State)

    # Wrap dependency-injected nodes with correct signatures
    async def node_fetch_crm(state: State) -> State:
        return await fetch_crm(state, ghl)

    async def node_classify(state: State) -> State:
        return await classify(state, llm_small)

    def node_plan(state: State) -> State:
        return plan(state)

    async def node_tag(state: State) -> State:
        return await tag(state, ghl)

    async def node_respond(state: State) -> State:
        return await respond(state, llm_big, ghl)

    async def node_book(state: State) -> State:
        return await book(state, ghl, llm_big)

    graph.add_node("fetch_crm", node_fetch_crm)
    graph.add_node("classify", node_classify)
    graph.add_node("plan", node_plan)
    graph.add_node("tag", node_tag)
    graph.add_node("respond", node_respond)
    graph.add_node("book", node_book)

    graph.add_edge("fetch_crm", "classify")
    graph.add_edge("classify", "plan")

    graph.add_conditional_edges(
        "plan",
        lambda s: s.planner.next_action,
        {
            "tag": "tag",
            "respond": "respond",
            "book": "book",
            "note": END,   # placeholder for future notes node
            "done": END,
        },
    )

    graph.add_edge("tag", END)
    graph.add_edge("respond", END)
    graph.add_edge("book", END)

    graph.set_entry_point("fetch_crm")

    # In-memory checkpoint for local dev (Cloud provides persistence)
    memory = MemorySaver()
    return graph.compile(checkpointer=memory)
