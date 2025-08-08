LangGraph Python Agent

This subfolder contains a Python LangGraph agent for the Outlet Media Bot.

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
