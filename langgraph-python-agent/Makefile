PY?=.venv/bin/python
PIP?=.venv/bin/pip
PORT?=8000

.PHONY: setup run dev imports health graph-dev fmt lint typecheck

setup:
	python3 -m venv .venv || true
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

run:
	$(PY) -m uvicorn app.web.webhook:app --host 127.0.0.1 --port $(PORT)

dev:
	$(PY) -m uvicorn app.web.webhook:app --host 127.0.0.1 --port $(PORT) --reload

imports:
	$(PY) -c "import importlib; app=importlib.import_module('app.web.webhook').app; graph=importlib.import_module('app.graph.compiled').graph; print('OK app:', app.title); print('OK graph:', type(graph))"

health:
	$(PY) scripts/health_check.py $(PORT)

graph-dev:
	# Requires LangGraph CLI installed: pip install langgraph-cli
	langgraph dev --config langgraph.json || echo "Install LangGraph CLI: pip install langgraph-cli"

fmt:
	# Optional: ruff format (if configured)
	ruff format || true

lint:
	# Optional: ruff check (if configured)
	ruff check || true

typecheck:
	# Optional: mypy type checking (if configured)
	mypy . || true

