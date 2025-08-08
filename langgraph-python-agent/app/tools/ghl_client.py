from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


class GhlError(Exception):
    pass


class GhlClient:
    """
    Minimal async client for Go High Level (LeadConnector) API endpoints used by the agent.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = "https://services.leadconnectorhq.com",
        timeout: float = 20.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token or os.getenv("GHL_API_KEY") or ""
        if not self.token:
            # We don't raise immediately to allow local dev of non-API paths,
            # but API calls will fail with 401 until set.
            pass
        self.timeout = timeout
        self._default_headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            # LeadConnector requires API version header
            "Version": os.getenv("GHL_API_VERSION", "2021-07-28"),
        }
        # Many endpoints also expect a LocationId header; include if configured
        loc_id = os.getenv("GHL_LOCATION_ID")
        if loc_id:
            self._default_headers["LocationId"] = loc_id

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        if extra:
            h = dict(self._default_headers)
            h.update(extra)
            return h
        return self._default_headers

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._headers(),
            timeout=self.timeout,
        )

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def get_contact(self, contact_id: str) -> Dict[str, Any]:
        """
        GET /contacts/{id}
        """
        async with self._client() as cx:
            resp = await cx.get(f"/contacts/{contact_id}")
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"get_contact failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def list_tags(self, location_id: str) -> Dict[str, Any]:
        """
        GET /locations/{locationId}/tags
        """
        async with self._client() as cx:
            resp = await cx.get(f"/locations/{location_id}/tags")
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"list_tags failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def create_tag(self, location_id: str, name: str) -> Dict[str, Any]:
        """
        POST /locations/{locationId}/tags
        """
        async with self._client() as cx:
            resp = await cx.post(f"/locations/{location_id}/tags", json={"name": name})
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"create_tag failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def assign_tags(self, contact_id: str, tag_names: List[str]) -> Dict[str, Any]:
        """
        POST /contacts/{contactId}/tags
        Some GHL accounts use tag IDs instead of names. This implementation assumes names;
        resolve IDs beforehand if your account requires it.
        """
        payload = {"tags": tag_names}
        async with self._client() as cx:
            resp = await cx.post(f"/contacts/{contact_id}/tags", json=payload)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"assign_tags failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def send_message(self, contact_id: str, text: str, channel: str = "sms") -> Dict[str, Any]:
        """
        POST /conversations/messages
        Payload shape may vary by channel; this is a minimal example.
        """
        payload = {
            "contactId": contact_id,
            "message": {"text": text},
            "channel": channel,
        }
        async with self._client() as cx:
            resp = await cx.post("/conversations/messages", json=payload)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"send_message failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def list_calendars(self, location_id: str) -> Dict[str, Any]:
        """
        GET /locations/{locationId}/calendars
        """
        async with self._client() as cx:
            resp = await cx.get(f"/locations/{location_id}/calendars")
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"list_calendars failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def list_contacts(self, page: int = 1, limit: int = 10) -> Dict[str, Any]:
        """
        GET /contacts
        Requires Version header and often a LocationId header; both are set if env vars provided.
        """
        params = {"page": page, "limit": limit}
        async with self._client() as cx:
            resp = await cx.get("/contacts", params=params)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"list_contacts failed: {e}") from e
            return resp.json()

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def create_appointment(self, calendar_id: str, contact_id: str, iso_time: str) -> Dict[str, Any]:
        """
        POST /appointments/
        """
        payload = {"calendarId": calendar_id, "contactId": contact_id, "startTime": iso_time}
        async with self._client() as cx:
            resp = await cx.post("/appointments/", json=payload)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise GhlError(f"create_appointment failed: {e}") from e
            return resp.json()

