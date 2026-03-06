import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  createStyles,
  makeStyles,
} from '@material-ui/core';
import {
  PlayArrow,
  Clear,
  RadioButtonChecked,
  CropFree,
  TouchApp,
} from '@material-ui/icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  opensppStatisticsSelector,
  opensppStatisticsLoadingSelector,
  fetchOpenSPPStatistics,
} from 'context/opensppStateSlice';
import {
  opensppQueryModeSelector,
  opensppQueryLoadingSelector,
  opensppQueryErrorSelector,
  opensppSpatialResultSelector,
  opensppProximityResultSelector,
  opensppProximityParamsSelector,
  setQueryMode,
  setProximityParams,
  setDrawnGeometry,
  clearQueryResults,
  executeOpenSPPSpatialQuery,
  executeOpenSPPProximityQuery,
} from 'context/opensppQueryStateSlice';
import useMapDraw from 'utils/useMapDraw';
import { useMapState } from 'utils/useMapState';
import type {
  SpatialQueryResponse,
  ProximityQueryResponse,
} from 'utils/openspp-types';
import type { Polygon } from 'geojson';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      width: '360px',
      maxWidth: '100%',
      boxSizing: 'border-box',
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    sectionTitle: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#333',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    panelTitle: {
      fontSize: '0.95rem',
      fontWeight: 600,
      color: '#222',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    modeToggle: {
      display: 'flex',
      gap: '8px',
    },
    modeButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.8rem',
      color: '#333',
      borderColor: '#aaa',
      '&.active': {
        backgroundColor: '#63B2BD',
        color: '#fff',
        borderColor: '#63B2BD',
      },
    },
    areaButtons: {
      display: 'flex',
      gap: '6px',
    },
    areaButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.78rem',
      color: '#333',
      borderColor: '#aaa',
      flex: 1,
      '&.active': {
        borderColor: '#63B2BD',
        color: '#63B2BD',
      },
    },
    actionButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.8rem',
    },
    runButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.8rem',
      backgroundColor: '#63B2BD',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#52a1ac',
      },
      '&.Mui-disabled': {
        backgroundColor: '#ccc',
        color: '#888',
      },
    },
    clearButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.8rem',
      color: '#555',
      borderColor: '#aaa',
    },
    resultSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    resultSummary: {
      fontSize: '0.8rem',
      color: '#555',
      lineHeight: 1.5,
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    resultCategory: {
      fontWeight: 600,
      fontSize: '0.78rem',
      color: '#333',
      padding: '6px 0 2px',
      borderBottom: '1px solid #ddd',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    resultRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      fontSize: '0.8rem',
      borderBottom: '1px solid #f5f5f5',
    },
    resultLabel: {
      color: '#555',
    },
    resultValue: {
      fontWeight: 500,
      color: '#222',
      fontVariantNumeric: 'tabular-nums',
    },
    error: {
      color: '#d32f2f',
      fontSize: '0.8rem',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    statusText: {
      fontSize: '0.78rem',
      fontStyle: 'italic',
      color: '#888',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    inputField: {
      '& .MuiInputLabel-root': {
        color: '#555',
      },
      '& .MuiOutlinedInput-root': {
        color: '#333',
        '& fieldset': {
          borderColor: '#aaa',
        },
      },
    },
    selectField: {
      '& .MuiInputLabel-root': {
        color: '#555',
      },
      '& .MuiOutlinedInput-root': {
        color: '#333',
        '& fieldset': {
          borderColor: '#aaa',
        },
      },
      '& .MuiSelect-icon': {
        color: '#555',
      },
    },
  }),
);

/** Format a stat value for display. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(2);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

const OpenSPPQueryPanel = memo(() => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const statistics = useSelector(opensppStatisticsSelector);
  const statisticsLoading = useSelector(opensppStatisticsLoadingSelector);
  const mode = useSelector(opensppQueryModeSelector);
  const loading = useSelector(opensppQueryLoadingSelector);
  const error = useSelector(opensppQueryErrorSelector);
  const spatialResult = useSelector(opensppSpatialResultSelector);
  const proximityResult = useSelector(opensppProximityResultSelector);
  const proximityParams = useSelector(opensppProximityParamsSelector);
  const { isDrawing, drawnGeometry, toggleDrawing } = useMapDraw();
  const mapState = useMapState();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedAreaName, setSelectedAreaName] = useState<string | null>(null);

  // Load statistics on mount (for all-variable queries)
  useEffect(() => {
    if (statistics.length === 0 && !statisticsLoading) {
      dispatch(fetchOpenSPPStatistics() as any);
    }
  }, [dispatch, statistics.length, statisticsLoading]);

  // All variable names for query (no manual selection needed)
  const allVariables = useMemo(
    () => statistics.flatMap(cat => cat.statistics.map(s => s.name)),
    [statistics],
  );

  // Click-to-select: register map click handler when selecting mode is active
  useEffect(() => {
    const map = mapState?.maplibreMap();
    if (!map || !isSelecting) {
      return;
    }

    const handleClick = (e: any) => {
      // Query all rendered fill layers at the click point
      const features = map.queryRenderedFeatures(e.point, {
        layers: map
          .getStyle()
          .layers.filter(
            (l: any) =>
              l.type === 'fill' && l.id.includes('boundary'),
          )
          .map((l: any) => l.id),
      });

      if (features.length > 0) {
        const feature = features[0];
        const geometry = feature.geometry as Polygon;
        const name =
          feature.properties?.ADM3_EN ||
          feature.properties?.ADM2_EN ||
          feature.properties?.ADM1_EN ||
          feature.properties?.name ||
          'Selected area';

        dispatch(setDrawnGeometry(geometry));
        setSelectedAreaName(name);
        setIsSelecting(false);
        map.getCanvas().style.cursor = '';
      }
    };

    map.getCanvas().style.cursor = 'pointer';
    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
      map.getCanvas().style.cursor = '';
    };
  }, [isSelecting, mapState, dispatch]);

  const handleRunQuery = useCallback(() => {
    if (mode === 'area') {
      if (!drawnGeometry) {
        return;
      }
      dispatch(
        executeOpenSPPSpatialQuery({
          geometry: drawnGeometry,
          variables: allVariables,
        }) as any,
      );
    } else {
      if (proximityParams.lat === null || proximityParams.lng === null) {
        return;
      }
      dispatch(
        executeOpenSPPProximityQuery({
          latitude: proximityParams.lat,
          longitude: proximityParams.lng,
          radius_km: proximityParams.radiusKm,
          relation: proximityParams.relation,
          variables: allVariables,
        }) as any,
      );
    }
  }, [dispatch, mode, drawnGeometry, allVariables, proximityParams]);

  const handleClear = useCallback(() => {
    dispatch(clearQueryResults());
    dispatch(setDrawnGeometry(null));
    setSelectedAreaName(null);
  }, [dispatch]);

  const handleToggleSelect = useCallback(() => {
    setIsSelecting(prev => !prev);
    setSelectedAreaName(null);
  }, []);

  const result: SpatialQueryResponse | ProximityQueryResponse | null =
    mode === 'area' ? spatialResult : proximityResult;

  const canRun = useMemo(() => {
    if (loading) {
      return false;
    }
    if (mode === 'area') {
      return !!drawnGeometry;
    }
    return proximityParams.lat !== null && proximityParams.lng !== null;
  }, [loading, mode, drawnGeometry, proximityParams]);

  return (
    <Box className={classes.root}>
      <Typography className={classes.panelTitle}>
        OpenSPP Query
      </Typography>

      {/* Mode toggle */}
      <Box className={classes.modeToggle}>
        <Button
          variant="outlined"
          size="small"
          className={`${classes.modeButton} ${mode === 'area' ? 'active' : ''}`}
          startIcon={<CropFree style={{ color: mode === 'area' ? '#fff' : '#555' }} />}
          onClick={() => dispatch(setQueryMode('area'))}
        >
          Area
        </Button>
        <Button
          variant="outlined"
          size="small"
          className={`${classes.modeButton} ${mode === 'proximity' ? 'active' : ''}`}
          startIcon={<RadioButtonChecked style={{ color: mode === 'proximity' ? '#fff' : '#555' }} />}
          onClick={() => dispatch(setQueryMode('proximity'))}
        >
          Proximity
        </Button>
      </Box>

      <Divider />

      {/* Query inputs */}
      {mode === 'area' ? (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>
            Select Area
          </Typography>
          <Box className={classes.areaButtons}>
            <Button
              variant="outlined"
              size="small"
              className={`${classes.areaButton} ${isSelecting ? 'active' : ''}`}
              startIcon={<TouchApp style={{ color: isSelecting ? '#63B2BD' : '#555' }} />}
              onClick={handleToggleSelect}
            >
              {isSelecting ? 'Click a shape...' : 'Select Shape'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              className={`${classes.areaButton} ${isDrawing ? 'active' : ''}`}
              startIcon={<CropFree style={{ color: isDrawing ? '#63B2BD' : '#555' }} />}
              onClick={toggleDrawing}
            >
              {isDrawing ? 'Drawing...' : 'Draw Area'}
            </Button>
          </Box>
          {drawnGeometry && (
            <Typography className={classes.statusText}>
              {selectedAreaName
                ? `Selected: ${selectedAreaName}`
                : 'Area selected'}
            </Typography>
          )}
        </Box>
      ) : (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>
            Proximity Parameters
          </Typography>
          <TextField
            className={classes.inputField}
            label="Latitude"
            type="number"
            size="small"
            variant="outlined"
            value={proximityParams.lat ?? ''}
            onChange={e =>
              dispatch(
                setProximityParams({
                  lat: e.target.value ? Number(e.target.value) : null,
                }),
              )
            }
            inputProps={{ step: 0.001, min: -90, max: 90 }}
          />
          <TextField
            className={classes.inputField}
            label="Longitude"
            type="number"
            size="small"
            variant="outlined"
            value={proximityParams.lng ?? ''}
            onChange={e =>
              dispatch(
                setProximityParams({
                  lng: e.target.value ? Number(e.target.value) : null,
                }),
              )
            }
            inputProps={{ step: 0.001, min: -180, max: 180 }}
          />
          <TextField
            className={classes.inputField}
            label="Radius (km)"
            type="number"
            size="small"
            variant="outlined"
            value={proximityParams.radiusKm}
            onChange={e =>
              dispatch(setProximityParams({ radiusKm: Number(e.target.value) }))
            }
            inputProps={{ step: 1, min: 1, max: 500 }}
          />
          <FormControl variant="outlined" size="small" className={classes.selectField}>
            <InputLabel>Relation</InputLabel>
            <Select
              value={proximityParams.relation}
              onChange={e =>
                dispatch(
                  setProximityParams({
                    relation: e.target.value as 'within' | 'beyond',
                  }),
                )
              }
              label="Relation"
            >
              <MenuItem value="within">Within radius</MenuItem>
              <MenuItem value="beyond">Beyond radius</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Action buttons */}
      <Box display="flex" style={{ gap: '8px' }}>
        <Button
          variant="contained"
          size="small"
          className={classes.runButton}
          startIcon={loading ? <CircularProgress size={16} style={{ color: '#fff' }} /> : <PlayArrow />}
          disabled={!canRun}
          onClick={handleRunQuery}
        >
          {loading ? 'Querying...' : 'Run Query'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          className={classes.clearButton}
          startIcon={<Clear style={{ color: '#555' }} />}
          onClick={handleClear}
        >
          Clear
        </Button>
      </Box>

      {/* Error */}
      {error && <Typography className={classes.error}>{error}</Typography>}

      {/* Results */}
      {result && (
        <Box className={classes.resultSection}>
          <Divider />
          <Typography className={classes.sectionTitle}>
            Results
          </Typography>
          <Box className={classes.resultSummary}>
            <div>
              <strong>Total Registrants:</strong>{' '}
              {(result.total_count ?? 0).toLocaleString()}
            </div>
            <div>
              <strong>Method:</strong> {result.query_method}
            </div>
            <div>
              <strong>Areas Matched:</strong> {result.areas_matched}
            </div>
          </Box>

          {/* Statistics results */}
          <Box style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {Object.entries(result.statistics).map(([key, value]) => {
              if (key === '_grouped') {
                return null;
              }
              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
              ) {
                return (
                  <Box key={key}>
                    <Typography className={classes.resultCategory}>
                      {key
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())}
                    </Typography>
                    {Object.entries(
                      value as Record<string, unknown>,
                    ).map(([subKey, subVal]) => (
                      <div key={subKey} className={classes.resultRow}>
                        <span className={classes.resultLabel}>
                          {typeof subVal === 'object' &&
                          subVal !== null &&
                          'label' in (subVal as Record<string, unknown>)
                            ? String(
                                (subVal as Record<string, unknown>).label,
                              )
                            : subKey
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className={classes.resultValue}>
                          {typeof subVal === 'object' &&
                          subVal !== null &&
                          'value' in (subVal as Record<string, unknown>)
                            ? formatValue(
                                (subVal as Record<string, unknown>).value,
                              )
                            : formatValue(subVal)}
                        </span>
                      </div>
                    ))}
                  </Box>
                );
              }
              return (
                <div key={key} className={classes.resultRow}>
                  <span className={classes.resultLabel}>
                    {key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className={classes.resultValue}>
                    {formatValue(value)}
                  </span>
                </div>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
});

export default OpenSPPQueryPanel;
