/**
 * TypeScript types for OpenSPP GIS API (spp_api_v2_gis).
 * Mirrors the Pydantic schemas from the OpenSPP backend.
 */
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

// === OAuth ===

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// === OGC Collections ===

export interface OGCLink {
  href: string;
  rel: string;
  type?: string;
  title?: string;
}

export interface SpatialExtent {
  bbox: number[][];
  crs: string;
}

export interface TemporalExtent {
  interval: (string | null)[][];
}

export interface CollectionExtent {
  spatial?: SpatialExtent;
  temporal?: TemporalExtent;
}

export interface CollectionInfo {
  id: string;
  title: string;
  description?: string;
  extent?: CollectionExtent;
  itemType: string;
  crs: string[];
  links: OGCLink[];
}

export interface CollectionsResponse {
  links: OGCLink[];
  collections: CollectionInfo[];
}

// === Spatial Query ===

export interface SpatialQueryRequest {
  geometry: Polygon | MultiPolygon;
  filters?: Record<string, boolean>;
  variables?: string[];
}

export interface SpatialQueryResponse {
  total_count: number;
  query_method: string;
  areas_matched: number;
  statistics: Record<string, unknown>;
  access_level?: string;
  from_cache: boolean;
  computed_at?: string;
}

// === Proximity Query ===

export interface ReferencePoint {
  longitude: number;
  latitude: number;
}

export interface ProximityQueryRequest {
  reference_points: ReferencePoint[];
  radius_km: number;
  relation: 'within' | 'beyond';
  filters?: Record<string, boolean>;
  variables?: string[];
}

export interface ProximityQueryResponse {
  total_count: number;
  query_method: string;
  areas_matched: number;
  reference_points_count: number;
  radius_km: number;
  relation: string;
  statistics: Record<string, unknown>;
  access_level?: string;
  from_cache: boolean;
  computed_at?: string;
}

// === Geofence ===

export type GeofenceType =
  | 'hazard_zone'
  | 'service_area'
  | 'targeting_area'
  | 'custom';

export const GEOFENCE_TYPE_COLORS: Record<GeofenceType, string> = {
  hazard_zone: '#d32f2f',
  service_area: '#1976d2',
  targeting_area: '#388e3c',
  custom: '#f9a825',
};

export const GEOFENCE_TYPE_LABELS: Record<GeofenceType, string> = {
  hazard_zone: 'Hazard Zone',
  service_area: 'Service Area',
  targeting_area: 'Targeting Area',
  custom: 'Custom',
};

export const GEOFENCE_DEFAULT_COLOR = '#999';

/** Build a MapLibre match expression for geofence type colors */
export function buildGeofenceColorExpression(): any[] {
  const entries = Object.entries(GEOFENCE_TYPE_COLORS).flat();
  return [
    'match',
    ['get', 'geofence_type'],
    ...entries,
    GEOFENCE_DEFAULT_COLOR,
  ];
}

export interface GeofenceCreateRequest {
  name: string;
  description?: string;
  geometry: Polygon | MultiPolygon;
  geofence_type: GeofenceType;
  incident_code?: string;
}

export interface GeofenceResponse {
  id: number;
  name: string;
  description?: string;
  geofence_type: string;
  area_sqkm: number;
  active: boolean;
  created_from: string;
}

export interface GeofenceListItem {
  id: number;
  name: string;
  geofence_type: string;
  area_sqkm: number;
  active: boolean;
}

export interface GeofenceListResponse {
  geofences: GeofenceListItem[];
  total: number;
  offset: number;
  count: number;
}

// === Statistics Discovery ===

export interface StatisticInfo {
  name: string;
  label: string;
  description?: string;
  format: 'count' | 'sum' | 'avg' | 'percent' | 'ratio' | 'currency';
  unit?: string;
}

export interface StatisticCategoryInfo {
  code: string;
  name: string;
  icon?: string;
  statistics: StatisticInfo[];
}

export interface StatisticsListResponse {
  categories: StatisticCategoryInfo[];
  total_count: number;
}

// === Convenience type for GeoJSON items endpoint ===

export type OpenSPPFeatureCollection = FeatureCollection;
