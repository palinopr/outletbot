#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-8000}"
if [ ! -x .venv/bin/python ]; then
  echo "Creating virtualenv..." >&2
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r requirements.txt >/dev/null
python -m uvicorn app.web.webhook:app --host 127.0.0.1 --port "$PORT" --reload

