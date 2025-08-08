from __future__ import annotations

from typing import Any


def to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict):
                t = c.get("text")
                if isinstance(t, str):
                    parts.append(t)
        return "\n".join(parts)
    return str(content)


def parse_json(text: str) -> Any:
    """Best-effort JSON extractor (strips code fences and trailing text)."""
    import json

    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        s = s[start : end + 1]
    try:
        return json.loads(s)
    except Exception:
        return None

