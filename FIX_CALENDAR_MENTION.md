# Fix for Premature Calendar Mention

## Issue
From trace `1f06a726-1ad2-66b8-8afb-8f05212f1e9d`, the bot may be mentioning calendar/appointments before collecting all required information.

## Current State
- Lead only has: name (Jaime)  
- Missing: problem, goal, budget, email
- Calendar validation IS working correctly (requires ALL fields)

## Root Cause
The AI might be mentioning scheduling/calendar in conversation before actually being able to show slots.

## Solution
Update the system prompt to be more explicit about NOT mentioning calendar/scheduling until ALL information is collected.

## Updated Prompt Addition
Add to CRITICAL RULES section:
```
4. NEVER mention calendar, scheduling, or appointments until leadInfo has ALL fields (name, problem, goal, budget >= $300, email)
5. If asked about scheduling before qualified, say "Primero necesito conocer más sobre tu negocio"
```

This ensures the AI doesn't create false expectations by mentioning calendar availability before the lead is fully qualified.