"""OpenSPP API proxy routes."""

import logging
import os
import time
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/openspp", tags=["openspp"])

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

OPENSPP_BASE_URL = os.environ.get("OPENSPP_BASE_URL", "")
OPENSPP_CLIENT_ID = os.environ.get("OPENSPP_CLIENT_ID", "")
OPENSPP_CLIENT_SECRET = os.environ.get("OPENSPP_CLIENT_SECRET", "")

# Per-worker token cache: (access_token, expiry_timestamp)
_token_cache: tuple[str, float] = ("", 0.0)


def _credentials_configured() -> bool:
    return bool(OPENSPP_BASE_URL and OPENSPP_CLIENT_ID and OPENSPP_CLIENT_SECRET)


async def _get_token() -> str:
    """Return a valid Bearer token, acquiring or refreshing as needed.

    The token is cached in-process per worker. Each worker manages its own
    token independently.
    """
    global _token_cache
    token, expiry = _token_cache
    if token and time.time() < expiry:
        return token

    token_url = f"{OPENSPP_BASE_URL}/api/v2/spp/oauth/token"
    logger.debug("Acquiring OpenSPP token from %s", token_url)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": OPENSPP_CLIENT_ID,
                    "client_secret": OPENSPP_CLIENT_SECRET,
                },
            )
        except httpx.RequestError as exc:
            logger.error("Token request failed: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach OpenSPP token endpoint: {exc}",
            )

    if response.status_code != 200:
        logger.error(
            "Token acquisition failed with status %s: %s",
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=502,
            detail=f"OpenSPP token acquisition failed: {response.text}",
        )

    data = response.json()
    new_token: str = data["access_token"]
    expires_in: int = data.get("expires_in", 3600)
    # Subtract 60 seconds as a safety margin before treating the token as expired.
    new_expiry = time.time() + expires_in - 60
    _token_cache = (new_token, new_expiry)
    logger.debug("OpenSPP token acquired, expires in %s seconds", expires_in)
    return new_token


def _require_credentials() -> None:
    """Raise 503 if OpenSPP credentials are not configured."""
    if not _credentials_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "OpenSPP integration is not configured. "
                "Set OPENSPP_BASE_URL, OPENSPP_CLIENT_ID, and OPENSPP_CLIENT_SECRET."
            ),
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/statistics")
async def get_statistics() -> Any:
    """Proxy GET statistics from OpenSPP GIS API."""
    _require_credentials()
    token = await _get_token()
    url = f"{OPENSPP_BASE_URL}/api/v2/spp/gis/statistics"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                url, headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP statistics request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code != 200:
        logger.error(
            "OpenSPP statistics returned %s: %s",
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=response.status_code, detail=response.text
        )

    return response.json()


@router.post("/spatial-statistics")
async def post_spatial_statistics(request: Request) -> Any:
    """Proxy spatial-statistics execution to OpenSPP.

    Returns the result directly for synchronous (200) responses, or a job
    descriptor for asynchronous (201) responses.
    """
    _require_credentials()
    token = await _get_token()
    url = (
        f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/processes"
        "/spatial-statistics/execution"
    )
    body = await request.json()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP spatial-statistics request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code == 200:
        return response.json()

    if response.status_code == 201:
        location = response.headers.get("Location", "")
        # Extract job ID from the Location URL path (last path segment).
        job_id: Optional[str] = None
        if location:
            path = urlparse(location).path.rstrip("/")
            job_id = path.split("/")[-1] if path else None
        status_url = f"/openspp/jobs/{job_id}" if job_id else None
        return {"job_id": job_id, "status_url": status_url}

    logger.error(
        "OpenSPP spatial-statistics returned %s: %s",
        response.status_code,
        response.text,
    )
    raise HTTPException(status_code=response.status_code, detail=response.text)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> Any:
    """Poll an async OpenSPP job. When successful, also fetches and returns results."""
    _require_credentials()
    token = await _get_token()
    job_url = f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/jobs/{job_id}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                job_url, headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP job status request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code != 200:
        logger.error(
            "OpenSPP job %s returned %s: %s",
            job_id,
            response.status_code,
            response.text,
        )
        raise HTTPException(status_code=response.status_code, detail=response.text)

    job_data = response.json()
    status = job_data.get("status")

    if status != "successful":
        return {"status": status, "result": None}

    # Fetch results now that the job is complete.
    results_url = f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/jobs/{job_id}/results"
    async with httpx.AsyncClient() as client:
        try:
            results_response = await client.get(
                results_url, headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP job results request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if results_response.status_code != 200:
        logger.error(
            "OpenSPP job results for %s returned %s: %s",
            job_id,
            results_response.status_code,
            results_response.text,
        )
        raise HTTPException(
            status_code=results_response.status_code, detail=results_response.text
        )

    return {"status": status, "result": results_response.json()}


@router.get("/geofences")
async def get_geofences() -> Any:
    """Proxy GET geofences FeatureCollection from OpenSPP."""
    _require_credentials()
    token = await _get_token()
    url = f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/collections/geofences/items"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                url, headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP geofences request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code != 200:
        logger.error(
            "OpenSPP geofences returned %s: %s",
            response.status_code,
            response.text,
        )
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()


@router.post("/geofences")
async def post_geofence(request: Request) -> Any:
    """Proxy POST a GeoJSON Feature to create a geofence in OpenSPP."""
    _require_credentials()
    token = await _get_token()
    url = f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/collections/geofences/items"
    body = await request.json()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP post geofence request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code not in (200, 201):
        logger.error(
            "OpenSPP post geofence returned %s: %s",
            response.status_code,
            response.text,
        )
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()


@router.put("/geofences/{feature_id}")
async def put_geofence(feature_id: str, request: Request) -> Any:
    """Proxy PUT a GeoJSON Feature to update a geofence in OpenSPP."""
    _require_credentials()
    token = await _get_token()
    url = (
        f"{OPENSPP_BASE_URL}/api/v2/spp/gis/ogc/collections"
        f"/geofences/items/{feature_id}"
    )
    body = await request.json()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                url,
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        except httpx.RequestError as exc:
            logger.error("OpenSPP put geofence request failed: %s", exc)
            raise HTTPException(
                status_code=502, detail=f"OpenSPP upstream error: {exc}"
            )

    if response.status_code not in (200, 201):
        logger.error(
            "OpenSPP put geofence returned %s: %s",
            response.status_code,
            response.text,
        )
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()
