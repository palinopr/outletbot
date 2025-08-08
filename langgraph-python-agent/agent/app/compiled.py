from __future__ import annotations

# Expose a compiled LangGraph instance as a module-level variable for the CLI.
# Use absolute import so it works when loaded as a standalone module by the CLI.
from app.graph import build_graph

graph = build_graph()
