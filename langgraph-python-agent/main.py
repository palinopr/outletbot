from __future__ import annotations

import os

from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

# FastAPI app for local dev and as ASGI entry (Cloud-compatible)
# - Exposes /health and /webhooks/ghl
from app.webhook import app  # noqa: E402

if __name__ == "__main__":
    # Local dev server
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.webhook:app", host="127.0.0.1", port=port, reload=True)
