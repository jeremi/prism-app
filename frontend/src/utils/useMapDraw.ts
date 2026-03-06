/**
 * Hook wrapping terra-draw for polygon drawing on MapLibre GL maps.
 * Used by OpenSPPQueryPanel and GeofencePanel to draw areas on the map.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { Polygon } from 'geojson';
import {
  opensppIsDrawingSelector,
  opensppDrawnGeometrySelector,
  setIsDrawing,
  setDrawnGeometry,
} from 'context/opensppQueryStateSlice';
import { useMapState } from './useMapState';

export default function useMapDraw() {
  const dispatch = useDispatch();
  const isDrawing = useSelector(opensppIsDrawingSelector);
  const drawnGeometry = useSelector(opensppDrawnGeometrySelector);
  const mapState = useMapState();
  const drawRef = useRef<TerraDraw | null>(null);

  // Initialize terra-draw when drawing starts
  useEffect(() => {
    const map = mapState?.maplibreMap();
    if (!map) {
      return;
    }

    if (isDrawing && !drawRef.current) {
      const adapter = new TerraDrawMapLibreGLAdapter({ map });
      const draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: '#1976d2',
              fillOpacity: 0.2,
              outlineColor: '#1976d2',
              outlineWidth: 2,
              closingPointColor: '#1976d2',
              closingPointWidth: 6,
              closingPointOutlineColor: '#fff',
              closingPointOutlineWidth: 2,
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            },
          }),
        ],
      });
      draw.start();
      draw.setMode('polygon');

      draw.on('finish', id => {
        const snapshot = draw.getSnapshot();
        const feature = snapshot.find(f => f.id === id);
        if (feature && feature.geometry.type === 'Polygon') {
          dispatch(setDrawnGeometry(feature.geometry as Polygon));
          dispatch(setIsDrawing(false));
        }
      });

      drawRef.current = draw;
    }

    if (!isDrawing && drawRef.current) {
      try {
        drawRef.current.stop();
      } catch {
        // terra-draw may throw if already stopped
      }
      drawRef.current = null;
    }

    return () => {
      if (drawRef.current) {
        try {
          drawRef.current.stop();
        } catch {
          // cleanup
        }
        drawRef.current = null;
      }
    };
  }, [isDrawing, mapState, dispatch]);

  const startDrawing = useCallback(() => {
    dispatch(setDrawnGeometry(null));
    dispatch(setIsDrawing(true));
  }, [dispatch]);

  const stopDrawing = useCallback(() => {
    dispatch(setIsDrawing(false));
  }, [dispatch]);

  const clearDrawing = useCallback(() => {
    dispatch(setDrawnGeometry(null));
    dispatch(setIsDrawing(false));
  }, [dispatch]);

  return {
    isDrawing,
    drawnGeometry,
    startDrawing,
    stopDrawing,
    clearDrawing,
  };
}
