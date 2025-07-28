# Confirmation Handling Guide

## Overview
The bot now intelligently handles user confirmations like "sí", standalone numbers, and other contextual responses.

## Supported Patterns

### 1. Budget Confirmations
```
Assistant: "¿Tu presupuesto mensual es de $500?"
User: "sí"
→ Extracts: budget = 500