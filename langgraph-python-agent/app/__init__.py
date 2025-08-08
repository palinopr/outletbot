# Marks 'app' as a package and exposes graph builder for external use (e.g., cloud runtimes)
from app.graph import build_graph

__all__ = ["build_graph"]
