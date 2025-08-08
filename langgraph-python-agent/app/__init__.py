# Marks 'app' as a package and exposes graph builder for external use (e.g., cloud runtimes)
from .graph import build_graph

__all__ = ["build_graph"]
