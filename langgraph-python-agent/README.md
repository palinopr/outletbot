LangGraph Python Agent

This folder mirrors the canonical agent under ~/outlet-media-bot/langgraph-python-agent.

Project structure
- app/
  - core/ — Pydantic models and shared types (State, etc.)
  - tools/ — external service clients (GHL API)
  - graph/ — graph builder and compiled entrypoint
  - web/ — FastAPI app and HTTP routes
  - nodes.py — agent node implementations (fetch, classify, plan, tag, respond, book)
- scripts/ — helper scripts for local tasks
- main.py — local dev server entrypoint
- langgraph.json — LangGraph CLI config (loads .env)

Quick start
- Create venv: python3 -m venv .venv && source .venv/bin/activate
- Install deps: pip install -r requirements.txt
- Configure env: cp .env.example .env and fill values
- Run locally: python main.py
- Or via LangGraph CLI: langgraph dev --config langgraph.json

Notes
- Do not commit secrets. .env is ignored.
- Main graph entry: app/compiled.py:graph (see langgraph.json)
- See LANGGRAPH_DEPLOYMENT_GUIDE.md for detailed deployment steps.
