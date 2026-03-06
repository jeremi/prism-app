import { memo, useEffect } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useDispatch, useSelector } from 'react-redux';
import { OpenSPPReportLayerProps, LegendDefinition } from 'config/types';
import { LayerData, loadLayerData } from 'context/layers/layer-data';
import { layerDataSelector } from 'context/mapStateSlice/selectors';
import { getLayerMapId } from 'utils/map-utils';
import { opacitySelector } from 'context/opacityStateSlice';
import { FillLayerSpecification } from 'maplibre-gl';

export interface LayersProps {
  layer: OpenSPPReportLayerProps;
  before?: string;
}

const paintProps: (
  legend: LegendDefinition,
  dataField: string,
  opacity: number | undefined,
) => FillLayerSpecification['paint'] = (legend, dataField, opacity) => ({
  'fill-opacity': opacity ?? 0.7,
  'fill-color': {
    property: dataField,
    type: 'categorical',
    stops: legend.map(({ value, color }) => [value, color]),
  },
});

/**
 * Renders OpenSPP report data as choropleth polygons.
 * Similar to GeojsonDataLayer but uses a configurable dataField
 * for the fill-color property lookup.
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

  if (!data) {
    return null;
  }

  return (
    <Source data={data} type="geojson">
      <Layer
        beforeId={before}
        id={layerId}
        type="fill"
        paint={paintProps(
          layer.legend || [],
          layer.dataField,
          opacityState ?? layer.opacity,
        )}
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
