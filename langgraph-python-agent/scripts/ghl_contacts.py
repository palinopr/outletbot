#!/usr/bin/env python
"""List contacts from GHL to find a test contactId."""
import os
import sys
import httpx
from dotenv import load_dotenv

# Load env
load_dotenv("agent/.env")

GHL_KEY = os.getenv("GHL_API_KEY")
GHL_LOC = os.getenv("GHL_LOCATION_ID")

if not GHL_KEY or not GHL_LOC:
    print("Missing GHL_API_KEY or GHL_LOCATION_ID")
    sys.exit(1)

headers = {
    "Authorization": f"Bearer {GHL_KEY}",
    "Version": "2021-07-28",
    "Accept": "application/json",
}

# List contacts
url = f"https://services.leadconnectorhq.com/contacts?locationId={GHL_LOC}&limit=5"
try:
    resp = httpx.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    
    print(f"Found {len(data.get('contacts', []))} contacts:\n")
    
    for contact in data.get("contacts", [])[:5]:
        cid = contact.get("id")
        fname = contact.get("firstName", "")
        lname = contact.get("lastName", "")
        name = contact.get("contactName") or f"{fname} {lname}".strip() or "No name"
        email = contact.get("email")
        phone = contact.get("phone")
        tags = contact.get("tags", [])
        
        print(f"ID: {cid}")
        print(f"Name: {name}")
        print(f"Email: {email}")
        print(f"Phone: {phone}")
        print(f"Tags: {tags}")
        print("-" * 40)
        
except Exception as e:
    print(f"Error: {e}")
    # Try alternate endpoint
    print("\nTrying alternate endpoint...")
    url2 = f"https://services.leadconnectorhq.com/contacts/"
    try:
        resp2 = httpx.get(url2, headers=headers, params={"locationId": GHL_LOC, "limit": 5}, timeout=10)
        print(f"Status: {resp2.status_code}")
        print(f"Response: {resp2.text[:500]}")
    except Exception as e2:
        print(f"Also failed: {e2}")
