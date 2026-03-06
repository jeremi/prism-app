import { memo, useEffect, useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useDispatch, useSelector } from 'react-redux';
import { OpenSPPReportLayerProps } from 'config/types';
import { LayerData, loadLayerData } from 'context/layers/layer-data';
import { layerDataSelector } from 'context/mapStateSlice/selectors';
import { getLayerMapId } from 'utils/map-utils';
import { opacitySelector } from 'context/opacityStateSlice';
import type { FillLayerSpecification, ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

export interface LayersProps {
  layer: OpenSPPReportLayerProps;
  before?: string;
}

/**
 * Build a match expression that reads bucket.color from each feature.
 * Falls back to transparent for features without bucket data.
 */
function buildBucketColorExpression(
  data: FeatureCollection,
): ExpressionSpecification {
  // Collect unique (bucket.index -> bucket.color) pairs from features
  const colorByIndex = new Map<number, string>();
  for (const feature of data.features) {
    const bucket = feature.properties?.bucket;
    if (bucket && typeof bucket === 'object' && bucket.color) {
      colorByIndex.set(bucket.index, bucket.color);
    }
  }

  if (colorByIndex.size === 0) {
    return 'transparent' as unknown as ExpressionSpecification;
  }

  // Build: ["match", ["get", "bucket_index"], idx1, color1, idx2, color2, ..., fallback]
  const matchArgs: (string | number | ExpressionSpecification)[] = [
    'match',
    ['get', 'bucket_index'],
  ];
  for (const [index, color] of colorByIndex.entries()) {
    matchArgs.push(index, color);
  }
  matchArgs.push('transparent'); // fallback
  return matchArgs as unknown as ExpressionSpecification;
}

/**
 * Pre-process GeoJSON to flatten bucket properties for MapLibre expressions.
 * MapLibre can't access nested properties (bucket.color), so we hoist them.
 */
function preprocessData(data: FeatureCollection): FeatureCollection {
  return {
    ...data,
    features: data.features.map(f => ({
      ...f,
      properties: {
        ...f.properties,
        bucket_index:
          f.properties?.bucket?.index ?? -1,
        bucket_color:
          f.properties?.bucket?.color ?? 'transparent',
        bucket_label:
          f.properties?.bucket?.label ?? '',
      },
    })),
  };
}

/**
 * Renders OpenSPP report data as choropleth polygons.
 * Uses server-provided bucket colors for consistent rendering with QGIS.
 */
const OpenSPPReportLayer = memo(({ layer, before }: LayersProps) => {
  const dispatch = useDispatch();
  const layerId = getLayerMapId(layer.id);
  const opacityState = useSelector(opacitySelector(layer.id));

  const layerData = useSelector(layerDataSelector(layer.id)) as
    | LayerData<OpenSPPReportLayerProps>
    | undefined;

  const { data } = layerData || {};

  useEffect(() => {
    dispatch(loadLayerData({ layer }));
  }, [dispatch, layer]);

  const processedData = useMemo(
    () => (data ? preprocessData(data as FeatureCollection) : null),
    [data],
  );

  const fillColor = useMemo(
    () =>
      processedData
        ? buildBucketColorExpression(processedData)
        : ('transparent' as unknown as ExpressionSpecification),
    [processedData],
  );

  if (!processedData) {
    return null;
  }

  const paint: FillLayerSpecification['paint'] = {
    'fill-opacity': opacityState ?? layer.opacity ?? 0.7,
    'fill-color': fillColor,
  };

  return (
    <Source data={processedData} type="geojson">
      <Layer
        beforeId={before}
        id={layerId}
        type="fill"
        paint={paint}
      />
      <Layer
        beforeId={before}
        id={`${layerId}-outline`}
        type="line"
        paint={{
          'line-color': '#666',
          'line-width': 0.5,
          'line-opacity': opacityState ?? 0.8,
        }}
      />
    </Source>
  );
});

export default OpenSPPReportLayer;
