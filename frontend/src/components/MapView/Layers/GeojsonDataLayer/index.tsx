import { memo, useCallback, useEffect, useRef } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { useDispatch, useSelector } from 'react-redux';
import { MapLayerMouseEvent } from 'maplibre-gl';
import { GeojsonDataLayerProps, LegendDefinition } from 'config/types';

import { LayerData, loadLayerData } from 'context/layers/layer-data';
import {
  layerDataSelector,
  mapSelector,
} from 'context/mapStateSlice/selectors';
import { getLayerMapId, useMapCallback } from 'utils/map-utils';
import { opacitySelector } from 'context/opacityStateSlice';
import { FillLayerSpecification } from 'maplibre-gl';
import {
  setSelectedGeometry,
  clearSelectedGeometry,
  opensppStatsSelector,
} from 'context/opensppStatsSlice';

const paintProps: (
  legend: LegendDefinition,
  opacity: number | undefined,
  dataField: string,
) => FillLayerSpecification['paint'] = (
  legend: LegendDefinition,
  opacity?: number,
  dataField: string = 'level',
) => ({
  'fill-opacity': opacity || 1,
  'fill-color': {
    property: dataField,
    type: 'categorical',
    stops: legend.map(({ value, color }) => [value, color]),
  },
});

// Polygon Data, takes any GeoJSON of polygons and shows it.
const GeojsonDataLayer = memo(({ layer, before }: LayersProps) => {
  const dispatch = useDispatch();
  const layerId = getLayerMapId(layer.id);
  const opacityState = useSelector(opacitySelector(layer.id));
  const map = useSelector(mapSelector);
  const { selectedGeometry } = useSelector(opensppStatsSelector);
  const featureClickedRef = useRef(false);

  const layerData = useSelector(layerDataSelector(layer.id)) as
    | LayerData<GeojsonDataLayerProps>
    | undefined;

  const { data } = layerData || {};

  useEffect(() => {
    dispatch(loadLayerData({ layer }));
  }, [dispatch, layer]);

  // Click handler for polygon features
  const onClick = useCallback(
    ({
      dispatch: d,
    }: {
      dispatch: any;
      layer: GeojsonDataLayerProps;
      t: any;
    }) =>
      (evt: MapLayerMouseEvent) => {
        const feature = evt.features?.[0];
        if (!feature || !feature.geometry) {
          return;
        }
        featureClickedRef.current = true;
        d(
          setSelectedGeometry({
            geometry: feature.geometry,
            properties: feature.properties || {},
          }),
        );
      },
    [],
  );

  // Register layer click handler
  useMapCallback('click', layerId, layer, onClick);

  // Map-level click handler to clear selection when clicking outside polygons
  useEffect(() => {
    if (!map) {
      return () => {};
    }

    const handleMapClick = () => {
      if (featureClickedRef.current) {
        featureClickedRef.current = false;
        return;
      }
      dispatch(clearSelectedGeometry());
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, dispatch]);

  if (!data) {
    return null;
  }

  return (
    <>
      <Source data={data} type="geojson">
        <Layer
          beforeId={before}
          id={layerId}
          type="fill"
          paint={paintProps(
            layer.legend || [],
            opacityState || layer.opacity,
            layer.dataField,
          )}
        />
      </Source>
      {selectedGeometry && (
        <Source
          id={`${layerId}-highlight-source`}
          type="geojson"
          data={{
            type: 'Feature',
            geometry: selectedGeometry as GeoJSON.Geometry,
            properties: {},
          }}
        >
          <Layer
            id={`${layerId}-highlight`}
            type="line"
            paint={{
              'line-color': '#FFFF00',
              'line-width': 4,
              'line-opacity': 1,
            }}
          />
        </Source>
      )}
    </>
  );
});

export interface LayersProps {
  layer: GeojsonDataLayerProps;
  before?: string;
}

export default GeojsonDataLayer;
