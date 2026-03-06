/**
 * OpenSPP GIS API client with OAuth2 Client Credentials authentication.
 *
 * Uses its own fetch logic (not fetchWithTimeout) to handle 401 retries
 * without triggering the global "Authentication failed" notification.
 */
import { OPENSPP_API_URL } from './constants';
import type {
  TokenResponse,
  CollectionsResponse,
  CollectionInfo,
  SpatialQueryRequest,
  SpatialQueryResponse,
  ProximityQueryRequest,
  ProximityQueryResponse,
  GeofenceCreateRequest,
  GeofenceResponse,
  GeofenceListResponse,
  GeofenceType,
  StatisticsListResponse,
  OpenSPPFeatureCollection,
} from './openspp-types';

// --- Auth state (module-level, not in localStorage) ---

let accessToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms

const CLIENT_ID = process.env.REACT_APP_OPENSPP_CLIENT_ID || '';
const CLIENT_SECRET = process.env.REACT_APP_OPENSPP_CLIENT_SECRET || '';
const TOKEN_REFRESH_BUFFER_MS = 60_000; // refresh 60s before expiry

// --- Internal helpers ---

async function authenticate(): Promise<string> {
  if (!OPENSPP_API_URL) {
    throw new Error('REACT_APP_OPENSPP_API_URL is not configured');
  }
  const res = await fetch(`${OPENSPP_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenSPP auth failed (${res.status}): ${detail}`);
  }
  const data: TokenResponse = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return accessToken;
}

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return accessToken;
  }
  return authenticate();
}

/**
 * Fetch wrapper that attaches Bearer token and retries once on 401.
 */
async function opensppFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!OPENSPP_API_URL) {
    throw new Error('REACT_APP_OPENSPP_API_URL is not configured');
  }

  const doFetch = async (token: string) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && init?.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${OPENSPP_API_URL}${path}`, { ...init, headers });
  };

  let token = await getToken();
  let res = await doFetch(token);

  // Retry once on 401 with a fresh token
  if (res.status === 401) {
    accessToken = null;
    token = await authenticate();
    res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenSPP API error (${res.status}): ${body}`);
  }

  return res;
}

// --- Public API methods ---

// == OGC Collections ==

export async function getCollections(): Promise<CollectionInfo[]> {
  const res = await opensppFetch('/gis/ogc/collections');
  const data: CollectionsResponse = await res.json();
  return data.collections;
}

export async function getCollectionItems(
  collectionId: string,
  options?: { bbox?: string; limit?: number; offset?: number },
): Promise<OpenSPPFeatureCollection> {
  const params = new URLSearchParams();
  if (options?.bbox) params.set('bbox', options.bbox);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const qs = params.toString();
  const path = `/gis/ogc/collections/${encodeURIComponent(collectionId)}/items${qs ? `?${qs}` : ''}`;
  const res = await opensppFetch(path);
  return res.json();
}

// == Statistics Discovery ==

export async function getStatistics(): Promise<StatisticsListResponse> {
  const res = await opensppFetch('/gis/statistics');
  return res.json();
}

// == Spatial Query ==

export async function querySpatialStatistics(
  request: SpatialQueryRequest,
): Promise<SpatialQueryResponse> {
  const res = await opensppFetch('/gis/query/statistics', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return res.json();
}

// == Proximity Query ==

export async function queryProximity(
  request: ProximityQueryRequest,
): Promise<ProximityQueryResponse> {
  const res = await opensppFetch('/gis/query/proximity', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return res.json();
}

// == Geofence CRUD ==

export async function createGeofence(
  request: GeofenceCreateRequest,
): Promise<GeofenceResponse> {
  const res = await opensppFetch('/gis/geofences', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function listGeofences(options?: {
  geofence_type?: GeofenceType;
  active?: boolean;
  _count?: number;
  _offset?: number;
}): Promise<GeofenceListResponse> {
  const params = new URLSearchParams();
  if (options?.geofence_type)
    params.set('geofence_type', options.geofence_type);
  if (options?.active !== undefined)
    params.set('active', String(options.active));
  if (options?._count) params.set('_count', String(options._count));
  if (options?._offset) params.set('_offset', String(options._offset));
  const qs = params.toString();
  const res = await opensppFetch(`/gis/geofences${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function getGeofence(
  geofenceId: number,
): Promise<GeofenceResponse> {
  const res = await opensppFetch(`/gis/geofences/${geofenceId}`);
  return res.json();
}

export async function deleteGeofence(geofenceId: number): Promise<void> {
  await opensppFetch(`/gis/geofences/${geofenceId}`, { method: 'DELETE' });
}
