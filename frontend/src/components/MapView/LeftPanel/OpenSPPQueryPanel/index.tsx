import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
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
  opensppSelectedVariablesSelector,
  opensppSpatialResultSelector,
  opensppProximityResultSelector,
  opensppProximityParamsSelector,
  setQueryMode,
  toggleVariable,
  setProximityParams,
  setDrawnGeometry,
  clearQueryResults,
  executeOpenSPPSpatialQuery,
  executeOpenSPPProximityQuery,
} from 'context/opensppQueryStateSlice';
import useMapDraw from 'utils/useMapDraw';
import type {
  SpatialQueryResponse,
  ProximityQueryResponse,
} from 'utils/openspp-types';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    modeToggle: {
      display: 'flex',
      gap: '8px',
    },
    statsGroup: {
      maxHeight: '200px',
      overflowY: 'auto',
      padding: '4px 8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
    },
    categoryTitle: {
      fontWeight: 600,
      fontSize: '0.85rem',
      marginTop: '8px',
    },
    resultTable: {
      width: '100%',
      borderCollapse: 'collapse',
      '& th, & td': {
        padding: '6px 8px',
        borderBottom: '1px solid #eee',
        fontSize: '0.8rem',
        textAlign: 'left',
      },
      '& th': {
        fontWeight: 600,
        backgroundColor: '#f5f5f5',
      },
    },
    error: {
      color: '#d32f2f',
      fontSize: '0.85rem',
    },
    drawButton: {
      textTransform: 'none',
    },
  }),
);

const OpenSPPQueryPanel = memo(() => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const statistics = useSelector(opensppStatisticsSelector);
  const statisticsLoading = useSelector(opensppStatisticsLoadingSelector);
  const mode = useSelector(opensppQueryModeSelector);
  const loading = useSelector(opensppQueryLoadingSelector);
  const error = useSelector(opensppQueryErrorSelector);
  const selectedVariables = useSelector(opensppSelectedVariablesSelector);
  const spatialResult = useSelector(opensppSpatialResultSelector);
  const proximityResult = useSelector(opensppProximityResultSelector);
  const proximityParams = useSelector(opensppProximityParamsSelector);
  const { isDrawing, drawnGeometry, startDrawing, stopDrawing } = useMapDraw();

  // Load statistics on mount
  useEffect(() => {
    if (statistics.length === 0 && !statisticsLoading) {
      dispatch(fetchOpenSPPStatistics() as any);
    }
  }, [dispatch, statistics.length, statisticsLoading]);

  const handleRunQuery = useCallback(() => {
    if (mode === 'area') {
      if (!drawnGeometry) {
        return;
      }
      dispatch(
        executeOpenSPPSpatialQuery({
          geometry: drawnGeometry,
          variables: selectedVariables,
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
          variables: selectedVariables,
        }) as any,
      );
    }
  }, [dispatch, mode, drawnGeometry, selectedVariables, proximityParams]);

  const handleClear = useCallback(() => {
    dispatch(clearQueryResults());
    dispatch(setDrawnGeometry(null));
  }, [dispatch]);

  const handleToggleDraw = useCallback(() => {
    if (isDrawing) {
      stopDrawing();
    } else {
      startDrawing();
    }
  }, [isDrawing, startDrawing, stopDrawing]);

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
      <Typography variant="h6">OpenSPP Query</Typography>

      {/* Mode toggle */}
      <Box className={classes.modeToggle}>
        <Button
          variant={mode === 'area' ? 'contained' : 'outlined'}
          color="primary"
          size="small"
          startIcon={<CropFree />}
          onClick={() => dispatch(setQueryMode('area'))}
        >
          Area Query
        </Button>
        <Button
          variant={mode === 'proximity' ? 'contained' : 'outlined'}
          color="primary"
          size="small"
          startIcon={<RadioButtonChecked />}
          onClick={() => dispatch(setQueryMode('proximity'))}
        >
          Proximity
        </Button>
      </Box>

      <Divider />

      {/* Statistics selection */}
      <Box className={classes.section}>
        <Typography variant="subtitle2">
          Statistics {statisticsLoading && <CircularProgress size={14} />}
        </Typography>
        <FormGroup className={classes.statsGroup}>
          {statistics.map(category => (
            <Box key={category.code}>
              <Typography className={classes.categoryTitle}>
                {category.name}
              </Typography>
              {category.statistics.map(stat => (
                <FormControlLabel
                  key={stat.name}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedVariables.includes(stat.name)}
                      onChange={() => dispatch(toggleVariable(stat.name))}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {stat.label}
                      {stat.unit ? ` (${stat.unit})` : ''}
                    </Typography>
                  }
                />
              ))}
            </Box>
          ))}
          {statistics.length === 0 && !statisticsLoading && (
            <Typography variant="body2" color="textSecondary">
              No statistics available
            </Typography>
          )}
        </FormGroup>
      </Box>

      <Divider />

      {/* Query inputs */}
      {mode === 'area' ? (
        <Box className={classes.section}>
          <Typography variant="subtitle2">Draw Area on Map</Typography>
          <Button
            variant="outlined"
            color={isDrawing ? 'secondary' : 'primary'}
            size="small"
            className={classes.drawButton}
            onClick={handleToggleDraw}
          >
            {isDrawing
              ? 'Stop Drawing'
              : drawnGeometry
                ? 'Redraw Area'
                : 'Start Drawing'}
          </Button>
          {drawnGeometry && (
            <Typography variant="body2" color="textSecondary">
              Area selected
            </Typography>
          )}
        </Box>
      ) : (
        <Box className={classes.section}>
          <Typography variant="subtitle2">Proximity Parameters</Typography>
          <TextField
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
          <FormControl variant="outlined" size="small">
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
          color="primary"
          size="small"
          startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
          disabled={!canRun}
          onClick={handleRunQuery}
        >
          {loading ? 'Querying...' : 'Run Query'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Clear />}
          onClick={handleClear}
        >
          Clear
        </Button>
      </Box>

      {/* Error */}
      {error && <Typography className={classes.error}>{error}</Typography>}

      {/* Results */}
      {result && (
        <Box className={classes.section}>
          <Typography variant="subtitle2">Results</Typography>
          <Typography variant="body2" color="textSecondary">
            Total registrants: {result.total_count} | Method:{' '}
            {result.query_method} | Areas matched: {result.areas_matched}
          </Typography>
          {result.computed_at && (
            <Typography variant="caption" color="textSecondary">
              Computed: {new Date(result.computed_at).toLocaleString()}
            </Typography>
          )}
          <table className={classes.resultTable}>
            <thead>
              <tr>
                <th>Statistic</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.statistics).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>
                    {typeof value === 'object' && value !== null
                      ? JSON.stringify(value)
                      : String(value ?? 'N/A')}
                  </td>
                </tr>
              ))}
              {Object.keys(result.statistics).length === 0 && (
                <tr>
                  <td colSpan={2}>No statistics returned</td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
});

export default OpenSPPQueryPanel;
