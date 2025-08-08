from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.state import State
from app.tools.ghl_client import GhlClient
from ._utils import to_text


async def respond(state: State, llm: Any, ghl: GhlClient) -> State:
    """Draft a bilingual response and send via GHL."""
    # Offline fallback if no LLM configured
    if llm is None:
        if state.nlp.language == "es":
            text = ("¡Gracias por tu mensaje! Para ayudarte mejor: ¿buscas más ventas, más clientes o lanzar algo nuevo? "
                    "Puedo proponerte opciones y agendar una llamada. ¿Tienes un presupuesto mensual o prefieres una sugerencia?")
        else:
            text = ("Thanks for reaching out! To help you better: are you aiming for more sales, more leads, or launching something new? "
                    "I can suggest options and book a quick call. Do you have a monthly budget or would you like a recommendation?")
        try:
            await ghl.send_message(state.contact_id, text, state.channel or "sms")
        except Exception:
            pass
        state.history.append({"role": "assistant", "content": text})  # type: ignore
        state.planner.next_action = "done"
        return state
    if state.nlp.language == "es":
        sys = "Eres un asistente de agencia. Sé claro, profesional y cercano. Prioriza agendar llamada."
        user = (
            f"Mensaje del cliente: {state.latest_text}\n"
            "Redacta una respuesta breve y empática en español. Pregunta su meta (ventas, clientes o lanzamiento), "
            "ofrece agendar una llamada y pregunta si tiene un presupuesto mensual o si prefiere una sugerencia."
        )
    else:
        sys = "You are an agency assistant. Be clear, professional, friendly. Prioritize booking a call."
        user = (
            f"User message: {state.latest_text}\n"
            "Write a brief, empathetic reply in English. Ask their main goal (sales, leads, or launch), "
            "offer to book a quick call, and ask if they have a monthly budget or prefer a suggestion."
        )
    res = await llm.ainvoke([SystemMessage(content=sys), HumanMessage(content=user)])
    text = to_text(res.content)
    try:
        await ghl.send_message(state.contact_id, text, state.channel or "sms")
    except Exception:
        pass
    state.history.append({"role": "assistant", "content": text})  # type: ignore
    state.planner.next_action = "done"
    return state

