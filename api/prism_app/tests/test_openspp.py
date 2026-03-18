"""Tests for the OpenSPP API proxy module."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import prism_app.openspp as openspp_module
from fastapi.testclient import TestClient
from httpx import Response as HttpxResponse
from prism_app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TOKEN_RESPONSE = {
    "access_token": "test-token-abc123",
    "token_type": "Bearer",
    "expires_in": 86400,
    "scope": "gis:all gis:read",
}

CREDENTIALS_ENV = {
    "OPENSPP_BASE_URL": "http://openspp.example.com",
    "OPENSPP_CLIENT_ID": "client_test",
    "OPENSPP_CLIENT_SECRET": "secret_test",
}


def make_httpx_response(status_code: int, json_body=None, text_body: str = "", headers=None):
    """Build a minimal mock httpx.Response."""
    mock = MagicMock(spec=HttpxResponse)
    mock.status_code = status_code
    if json_body is not None:
        mock.json.return_value = json_body
    mock.text = text_body or (str(json_body) if json_body is not None else "")
    mock.headers = headers or {}
    return mock


# ---------------------------------------------------------------------------
# Token management tests
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_token_cache():
    """Clear the in-process token cache before each test."""
    openspp_module._token_cache = ("", 0.0)
    # Also reset the module-level env vars read at import time.
    original_base = openspp_module.OPENSPP_BASE_URL
    original_id = openspp_module.OPENSPP_CLIENT_ID
    original_secret = openspp_module.OPENSPP_CLIENT_SECRET
    yield
    openspp_module._token_cache = ("", 0.0)
    openspp_module.OPENSPP_BASE_URL = original_base
    openspp_module.OPENSPP_CLIENT_ID = original_id
    openspp_module.OPENSPP_CLIENT_SECRET = original_secret


@pytest.mark.asyncio
async def test_get_token_acquires_new_token():
    """_get_token should POST to the token endpoint and cache the result."""
    openspp_module.OPENSPP_BASE_URL = "http://openspp.example.com"
    openspp_module.OPENSPP_CLIENT_ID = "client_test"
    openspp_module.OPENSPP_CLIENT_SECRET = "secret_test"

    token_resp = make_httpx_response(200, json_body=TOKEN_RESPONSE)

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=token_resp)

    with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
        token = await openspp_module._get_token()

    assert token == "test-token-abc123"
    # Token and expiry should now be cached.
    cached_token, cached_expiry = openspp_module._token_cache
    assert cached_token == "test-token-abc123"
    assert cached_expiry > time.time()


@pytest.mark.asyncio
async def test_get_token_uses_cache():
    """_get_token should not call the token endpoint when a valid token is cached."""
    openspp_module.OPENSPP_BASE_URL = "http://openspp.example.com"
    # Seed a valid cache entry that expires far in the future.
    openspp_module._token_cache = ("cached-token", time.time() + 3600)

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock()

    with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
        token = await openspp_module._get_token()

    assert token == "cached-token"
    mock_client.post.assert_not_called()


@pytest.mark.asyncio
async def test_get_token_refreshes_expired_token():
    """_get_token should refresh the token when the cached one has expired."""
    openspp_module.OPENSPP_BASE_URL = "http://openspp.example.com"
    openspp_module.OPENSPP_CLIENT_ID = "client_test"
    openspp_module.OPENSPP_CLIENT_SECRET = "secret_test"
    # Seed an expired cache entry.
    openspp_module._token_cache = ("old-token", time.time() - 1)

    token_resp = make_httpx_response(200, json_body=TOKEN_RESPONSE)

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=token_resp)

    with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
        token = await openspp_module._get_token()

    assert token == "test-token-abc123"
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_get_token_raises_502_on_upstream_failure():
    """_get_token should raise 502 when the token endpoint returns a non-200."""
    openspp_module.OPENSPP_BASE_URL = "http://openspp.example.com"
    openspp_module.OPENSPP_CLIENT_ID = "client_test"
    openspp_module.OPENSPP_CLIENT_SECRET = "secret_test"

    error_resp = make_httpx_response(401, text_body="Unauthorized")

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=error_resp)

    from fastapi import HTTPException

    with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await openspp_module._get_token()

    assert exc_info.value.status_code == 502


# ---------------------------------------------------------------------------
# 503 when credentials are not configured
# ---------------------------------------------------------------------------


def test_statistics_returns_503_when_not_configured():
    with patch.dict(
        "os.environ",
        {"OPENSPP_BASE_URL": "", "OPENSPP_CLIENT_ID": "", "OPENSPP_CLIENT_SECRET": ""},
    ):
        openspp_module.OPENSPP_BASE_URL = ""
        openspp_module.OPENSPP_CLIENT_ID = ""
        openspp_module.OPENSPP_CLIENT_SECRET = ""
        response = client.get("/openspp/statistics")
    assert response.status_code == 503


def test_spatial_statistics_returns_503_when_not_configured():
    openspp_module.OPENSPP_BASE_URL = ""
    openspp_module.OPENSPP_CLIENT_ID = ""
    openspp_module.OPENSPP_CLIENT_SECRET = ""
    response = client.post("/openspp/spatial-statistics", json={"inputs": {}})
    assert response.status_code == 503


def test_geofences_returns_503_when_not_configured():
    openspp_module.OPENSPP_BASE_URL = ""
    openspp_module.OPENSPP_CLIENT_ID = ""
    openspp_module.OPENSPP_CLIENT_SECRET = ""
    response = client.get("/openspp/geofences")
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# Happy-path route tests
# ---------------------------------------------------------------------------


def _patch_get_token(token: str = "test-token-abc123"):
    """Return a patch context manager for _get_token."""
    return patch("prism_app.openspp._get_token", new=AsyncMock(return_value=token))


def _patch_credentials(configured: bool = True):
    return patch(
        "prism_app.openspp._credentials_configured", return_value=configured
    )


def _make_async_client_mock(get_response=None, post_response=None, put_response=None):
    """Build a mock AsyncClient that returns given responses for HTTP methods."""
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    if get_response is not None:
        mock_client.get = AsyncMock(return_value=get_response)
    if post_response is not None:
        mock_client.post = AsyncMock(return_value=post_response)
    if put_response is not None:
        mock_client.put = AsyncMock(return_value=put_response)
    return mock_client


def test_get_statistics_happy_path():
    """GET /openspp/statistics should return JSON from upstream."""
    stats_data = {"beneficiaries": 1234, "regions": 5}
    upstream_resp = make_httpx_response(200, json_body=stats_data)
    mock_client = _make_async_client_mock(get_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/statistics")

    assert response.status_code == 200
    assert response.json() == stats_data


def test_get_statistics_upstream_error():
    """GET /openspp/statistics should forward upstream error status codes."""
    upstream_resp = make_httpx_response(500, text_body="Internal Server Error")
    mock_client = _make_async_client_mock(get_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/statistics")

    assert response.status_code == 500


def test_post_spatial_statistics_sync_200():
    """POST /openspp/spatial-statistics with a 200 response returns result directly."""
    result_data = {
        "total_count": 42,
        "query_method": "coordinates",
        "areas_matched": 1,
        "statistics": {},
        "breakdown": {},
    }
    upstream_resp = make_httpx_response(200, json_body=result_data)
    mock_client = _make_async_client_mock(post_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.post(
                "/openspp/spatial-statistics",
                json={"inputs": {"geometry": {}, "group_by": ["gender", "age_group"]}},
            )

    assert response.status_code == 200
    assert response.json() == result_data


def test_post_spatial_statistics_async_201():
    """POST /openspp/spatial-statistics with 201 returns job descriptor."""
    location = "http://openspp.example.com/api/v2/spp/gis/ogc/jobs/job-xyz-789"
    upstream_resp = make_httpx_response(
        201, json_body={}, headers={"Location": location}
    )
    mock_client = _make_async_client_mock(post_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.post(
                "/openspp/spatial-statistics",
                json={"inputs": {"geometry": {}, "group_by": ["gender", "age_group"]}},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == "job-xyz-789"
    assert body["status_url"] == "/openspp/jobs/job-xyz-789"


def test_post_spatial_statistics_upstream_error():
    """POST /openspp/spatial-statistics forwards upstream errors."""
    upstream_resp = make_httpx_response(422, text_body="Unprocessable Entity")
    mock_client = _make_async_client_mock(post_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.post("/openspp/spatial-statistics", json={})

    assert response.status_code == 422


def test_get_job_pending():
    """GET /openspp/jobs/{id} returns status=running with null result when not done."""
    job_data = {"status": "running", "message": "Processing..."}
    upstream_resp = make_httpx_response(200, json_body=job_data)
    mock_client = _make_async_client_mock(get_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/jobs/job-123")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "running"
    assert body["result"] is None


def test_get_job_successful_fetches_results():
    """GET /openspp/jobs/{id} fetches results when job is successful."""
    job_data = {"status": "successful"}
    results_data = {"total_count": 99, "breakdown": {"male": 50, "female": 49}}

    job_resp = make_httpx_response(200, json_body=job_data)
    results_resp = make_httpx_response(200, json_body=results_data)

    # Both calls go through the same mock client; we need get called twice.
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=[job_resp, results_resp])

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/jobs/job-456")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "successful"
    assert body["result"] == results_data


def test_get_job_upstream_error():
    """GET /openspp/jobs/{id} forwards upstream errors."""
    upstream_resp = make_httpx_response(404, text_body="Job not found")
    mock_client = _make_async_client_mock(get_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/jobs/nonexistent")

    assert response.status_code == 404


def test_get_geofences_happy_path():
    """GET /openspp/geofences should return GeoJSON FeatureCollection."""
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": []},
                "properties": {"name": "Zone A"},
            }
        ],
    }
    upstream_resp = make_httpx_response(200, json_body=geojson)
    mock_client = _make_async_client_mock(get_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.get("/openspp/geofences")

    assert response.status_code == 200
    assert response.json()["type"] == "FeatureCollection"


def test_post_geofence_happy_path():
    """POST /openspp/geofences should forward a GeoJSON Feature and return the result."""
    feature = {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": []},
        "properties": {"name": "New Zone"},
    }
    upstream_resp = make_httpx_response(201, json_body=feature)
    mock_client = _make_async_client_mock(post_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.post("/openspp/geofences", json=feature)

    assert response.status_code == 200
    assert response.json() == feature


def test_put_geofence_happy_path():
    """PUT /openspp/geofences/{id} should forward updates and return the result."""
    feature = {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": []},
        "properties": {"name": "Updated Zone"},
    }
    upstream_resp = make_httpx_response(200, json_body=feature)
    mock_client = _make_async_client_mock(put_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.put("/openspp/geofences/feature-uuid-001", json=feature)

    assert response.status_code == 200
    assert response.json() == feature


def test_put_geofence_upstream_error():
    """PUT /openspp/geofences/{id} should forward upstream errors."""
    upstream_resp = make_httpx_response(400, text_body="Bad request")
    mock_client = _make_async_client_mock(put_response=upstream_resp)

    with _patch_credentials(), _patch_get_token():
        with patch("prism_app.openspp.httpx.AsyncClient", return_value=mock_client):
            response = client.put("/openspp/geofences/bad-id", json={})

    assert response.status_code == 400
