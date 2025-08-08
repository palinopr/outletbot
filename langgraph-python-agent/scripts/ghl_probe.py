from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List, Tuple

# Minimal dependency-free probe using requests-like httpx if available, else stdlib urllib
# But since our venv has httpx, we'll use it.
import httpx
from dotenv import load_dotenv

def load_env_from(path: str) -> None:
    try:
        load_dotenv(path)
    except Exception:
        pass

def get_token() -> str:
    token = os.getenv("GHL_API_KEY", "")
    if not token:
        print("[ERROR] GHL_API_KEY is not set. Populate agent/.env or local .env", file=sys.stderr)
        sys.exit(1)
    return token

BASE = "https://services.leadconnectorhq.com"

CANDIDATE_ENDPOINTS: List[str] = [
    "/locations",
    "/location",
    "/users/me",
    "/users/self",
    "/calendars",
    "/locations/calendars",
    "/contacts",
    "/tags",
    "/integrations/self",
    "/me",
]

def try_get(client: httpx.Client, path: str) -> Tuple[int, Any]:
    try:
        r = client.get(path)
        ct = r.headers.get("content-type", "")
        if "application/json" in ct:
            data = r.json()
        else:
            data = r.text
        return r.status_code, data
    except Exception as e:
        return -1, str(e)

def summarize(obj: Any) -> str:
    try:
        if isinstance(obj, dict):
            keys = list(obj.keys())
            return f"dict keys={keys[:10]}"
        if isinstance(obj, list):
            return f"list len={len(obj)} sample={obj[:1]}"
        s = str(obj)
        return s[:200]
    except Exception:
        return str(obj)[:200]

def extract_location_ids(obj: Any) -> List[str]:
    ids: List[str] = []
    def visit(x: Any):
        nonlocal ids
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("id", "locationId", "location_id") and isinstance(v, str):
                    # Heuristic: IDs are often UUID-like or short strings; capture likely candidates
                    ids.append(v)
                visit(v)
        elif isinstance(x, list):
            for it in x:
                visit(it)
    visit(obj)
    # Deduplicate while preserving order
    seen = set()
    out: List[str] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out

def main() -> None:
    # Prefer container env if present
    # Try agent/.env, else local .env
    env_paths = ["agent/.env", ".env"]
    for p in env_paths:
        if os.path.exists(p):
            load_env_from(p)

    token = get_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        # LeadConnector requires an API version header
        "Version": os.getenv("GHL_API_VERSION", "2021-07-28"),
    }
    # If you already know your location, this header unlocks many endpoints
    loc_id = os.getenv("GHL_LOCATION_ID")
    if loc_id:
        headers["LocationId"] = loc_id  # some endpoints expect this header

    found_locations: List[str] = []
    try:
        with httpx.Client(base_url=BASE, headers=headers, timeout=20) as client:
            print(f"[INFO] Probing LeadConnector base {BASE}")
            for ep in CANDIDATE_ENDPOINTS:
                code, data = try_get(client, ep)
                print(f"[PROBE] GET {ep} -> {code} - {summarize(data)}")
                # show full error body on 401/403 to help diagnose
                if code in (401, 403):
                    try:
                        print(f"[DETAIL] {json.dumps(data, ensure_ascii=False)}")
                    except Exception:
                        print(f"[DETAIL] {data}")
                if code == 200:
                    locs = extract_location_ids(data)
                    if locs:
                        print(f"[HINT] Candidate location IDs from {ep}: {locs}")
                        for i in locs:
                            if i not in found_locations:
                                found_locations.append(i)
            # If we have a candidate location, try calendars under it
            for loc in found_locations[:3]:
                path = f"/locations/{loc}/calendars"
                code, data = try_get(client, path)
                print(f"[PROBE] GET {path} -> {code} - {summarize(data)}")
                if code == 200:
                    cals = []
                    try:
                        # Typical shape: {"data":[{"id":"...","name":"..."}]}
                        arr = data.get("data", []) if isinstance(data, dict) else []
                        for it in arr:
                            if isinstance(it, dict) and "id" in it:
                                cals.append(it.get("id"))
                    except Exception:
                        pass
                    if cals:
                        print(f"[HINT] Calendars for location {loc}: {cals}")
    except Exception as e:
        print(f"[ERROR] Probe failed: {e}", file=sys.stderr)
        sys.exit(1)

    print("\n[SUMMARY]")
    if found_locations:
        print(f"Found candidate location IDs: {found_locations}")
        print("Next: set GHL_LOCATION_ID in agent/.env to one of these and (optionally) a calendar ID.")
    else:
        print("No obvious location IDs found. The token may already be scoped to a single location; we can try a booking/send without explicit location if endpoints allow, or adjust endpoints.")

if __name__ == "__main__":
    main()
