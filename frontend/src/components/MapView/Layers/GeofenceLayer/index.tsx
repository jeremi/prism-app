import { memo, useEffect, useState } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import type { FeatureCollection } from 'geojson';
import { opensppGeofencesSelector } from 'context/opensppStateSlice';
import { getGeofence } from 'utils/openspp-api';
import { buildGeofenceColorExpression } from 'utils/openspp-types';
import { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import { appConfig } from 'config';

const geofenceColorExpr = buildGeofenceColorExpression();

const fillPaint: FillLayerSpecification['paint'] = {
  'fill-opacity': 0.25,
  'fill-color': geofenceColorExpr,
};

const linePaint: LineLayerSpecification['paint'] = {
  'line-width': 2,
  'line-color': geofenceColorExpr,
};

/**
 * Renders geofences from OpenSPP on the map.
 * Fetches full geofence geometry (with GeoJSON) and displays them
 * with color-coded styling per geofence type.
 */
const GeofenceLayer = memo(({ before }: { before?: string }) => {
  const geofences = useSelector(opensppGeofencesSelector);
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);

  const isEnabled = appConfig.openspp?.enabled;

  // Build GeoJSON from geofence data when geofences change
  useEffect(() => {
    if (!isEnabled || geofences.length === 0) {
      setGeoJson(null);
      return;
    }

    let cancelled = false;

    // Fetch full geofence data (with geometry) for each geofence
    // Note: individual fetches are needed as the list endpoint omits geometry
    const loadGeofences = async () => {
      try {
        const fullGeofences = await Promise.all(
          geofences.map(gf => getGeofence(gf.id)),
        );
        if (cancelled) {
          return;
        }
        const features = fullGeofences
          .filter((gf: any) => gf.geometry)
          .map((gf: any) => ({
            type: 'Feature' as const,
            properties: {
              id: gf.id,
              name: gf.name,
              geofence_type: gf.geofence_type,
              area_sqkm: gf.area_sqkm,
              active: gf.active,
            },
            geometry: gf.geometry,
          }));
        setGeoJson({
          type: 'FeatureCollection',
          features,
        });
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load geofence geometries:', err);
        }
      }
    };

    loadGeofences();
    return () => {
      cancelled = true;
    };
  }, [geofences, isEnabled]);

  if (!isEnabled || !geoJson || geoJson.features.length === 0) {
    return null;
  }

  return (
    <Source id="openspp-geofences" data={geoJson} type="geojson">
      <Layer
        id="openspp-geofences-fill"
        beforeId={before}
        type="fill"
        paint={fillPaint}
      />
      <Layer
        id="openspp-geofences-line"
        beforeId={before}
        type="line"
        paint={linePaint}
      />
    </Source>
  );
});

export default GeofenceLayer;
