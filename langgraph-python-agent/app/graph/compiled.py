from __future__ import annotations

# Expose a compiled LangGraph instance as a module-level variable for the CLI
from app.graph.graph import build_graph

graph = build_graph()
