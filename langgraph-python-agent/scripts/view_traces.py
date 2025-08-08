#!/usr/bin/env python
"""View LangSmith traces for the GHL agent."""
import os
from datetime import datetime, timedelta
from langsmith import Client
from dotenv import load_dotenv

# Load environment
load_dotenv("agent/.env")

# Initialize LangSmith client
client = Client()

# Project name from env
project_name = os.getenv("LANGCHAIN_PROJECT", "ghl-agency-prod")

print(f"🔍 Viewing traces for project: {project_name}\n")

# Get recent runs (last hour)
start_time = datetime.now() - timedelta(hours=1)

try:
    runs = list(client.list_runs(
        project_name=project_name,
        start_time=start_time,
        limit=10
    ))
    
    if not runs:
        print("No recent runs found in the last hour.")
        print(f"\nTo view traces:")
        print(f"1. Open: https://smith.langchain.com/projects")
        print(f"2. Select project: {project_name}")
        print(f"3. Click on 'Runs' tab")
    else:
        print(f"Found {len(runs)} recent runs:\n")
        
        for run in runs:
            print(f"Run ID: {run.id}")
            print(f"Name: {run.name}")
            print(f"Status: {run.status}")
            print(f"Start: {run.start_time}")
            print(f"Duration: {run.end_time - run.start_time if run.end_time else 'Running'}")
            
            # Show input/output if available
            if run.inputs:
                print(f"Input: {run.inputs}")
            if run.outputs:
                print(f"Output: {run.outputs}")
            
            # Direct link to trace
            print(f"View trace: https://smith.langchain.com/public/{run.id}/r")
            print("-" * 60)
            
        print(f"\n📊 View all traces at:")
        print(f"https://smith.langchain.com/o/{client._tenant_id}/projects/p/{project_name}")
        
except Exception as e:
    print(f"Error fetching runs: {e}")
    print("\nMake sure:")
    print("1. LANGSMITH_API_KEY is set correctly")
    print("2. You have access to the project")
    print("3. The project name is correct")

# Show how to enable tracing
print("\n💡 To enable tracing in your code:")
print("```python")
print("import os")
print("os.environ['LANGCHAIN_TRACING_V2'] = 'true'")
print("os.environ['LANGCHAIN_PROJECT'] = 'ghl-agency-prod'")
print("```")
