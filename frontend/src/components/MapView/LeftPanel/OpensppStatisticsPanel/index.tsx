import { memo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Typography,
} from '@material-ui/core';
import { Close as CloseIcon } from '@material-ui/icons';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { useDispatch, useSelector } from 'react-redux';
import {
  opensppStatsSelector,
  clearSelectedGeometry,
  BreakdownEntry,
} from 'context/opensppStatsSlice';
import { useOpensppStats } from './useOpensppStats';
import SaveTargetingZoneDialog from './SaveTargetingZoneDialog';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      position: 'absolute',
      top: 56,
      right: 0,
      width: 380,
      maxHeight: 'calc(100vh - 56px)',
      overflowY: 'auto',
      zIndex: 1400,
      borderRadius: '8px 0 0 8px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    content: {
      padding: theme.spacing(0, 2, 2, 2),
    },
    primaryStat: {
      fontSize: '2rem',
      fontWeight: 700,
      color: theme.palette.primary.main,
    },
    secondaryStat: {
      fontSize: '1.1rem',
      color: theme.palette.text.secondary,
    },
    contextLine: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
      marginTop: theme.spacing(0.5),
    },
    demoLabel: {
      color: theme.palette.warning.main,
      fontSize: '0.75rem',
      fontStyle: 'italic',
      marginBottom: theme.spacing(1),
    },
    breakdownRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(0.25, 0),
    },
    breakdownLabel: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
    },
    breakdownValue: {
      fontWeight: 500,
      fontSize: '0.875rem',
    },
    centerContent: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(4),
      textAlign: 'center',
    },
  }),
);

function formatStat(value: number | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return value.toLocaleString();
}

function aggregateBreakdown(
  breakdown: Record<string, BreakdownEntry> | null,
  dimension: string,
): { label: string; count: number }[] {
  if (!breakdown) {
    return [];
  }
  const aggregated: Record<string, { label: string; count: number }> = {};

  Object.values(breakdown).forEach(entry => {
    if (entry.suppressed || !entry.labels || typeof entry.count !== 'number') {
      return;
    }
    const dim = entry.labels[dimension];
    if (!dim) {
      return;
    }
    const key = dim.value;
    if (!aggregated[key]) {
      aggregated[key] = { label: dim.display, count: 0 };
    }
    aggregated[key].count += entry.count;
  });

  return Object.values(aggregated).sort((a, b) => b.count - a.count);
}

function hasSuppressionInBreakdown(
  breakdown: Record<string, BreakdownEntry> | null,
): boolean {
  if (!breakdown) {
    return false;
  }
  return Object.values(breakdown).some(entry => entry.suppressed);
}

const OpensppStatisticsPanel = memo(() => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const { status, result, selectedFeatureProperties, selectedLayerTitle } =
    useSelector(opensppStatsSelector);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Hook that watches selectedGeometry and triggers API calls
  useOpensppStats();

  const handleSaved = () => {
    setSnackbarOpen(true);
  };

  if (status === 'idle') {
    return null;
  }

  const severityLevel = selectedFeatureProperties?.level;
  const handleClose = () => dispatch(clearSelectedGeometry());

  return (
    <>
      <Paper className={classes.root} elevation={3}>
        <Box className={classes.header}>
          <Box>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {selectedLayerTitle}
              {severityLevel ? ` - ${severityLevel} severity` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>

        {status === 'loading' && (
          <Box className={classes.centerContent}>
            <CircularProgress size={32} />
            <Typography
              variant="body2"
              style={{ marginTop: 12 }}
              color="textSecondary"
            >
              Querying OpenSPP...
            </Typography>
          </Box>
        )}

        {status === 'error' && (
          <Box className={classes.centerContent}>
            <Typography variant="body2" color="textSecondary">
              Could not load statistics.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Try a smaller area or retry.
            </Typography>
          </Box>
        )}

        {status === 'zero_results' && (
          <Box className={classes.centerContent}>
            <Typography variant="body2" color="textSecondary">
              No registered beneficiaries
            </Typography>
            <Typography variant="body2" color="textSecondary">
              found in affected barangays.
            </Typography>
          </Box>
        )}

        {status === 'success' && result && (
          <Box className={classes.content}>
            <Typography className={classes.demoLabel}>
              Demo data — not real beneficiaries
            </Typography>

            <Typography
              variant="body2"
              style={{ fontWeight: 500, marginBottom: 2 }}
            >
              Program-enrolled households:
            </Typography>
            <Typography className={classes.primaryStat}>
              {formatStat(result.statistics.enrolled_any_program)}
            </Typography>

            <Box style={{ marginTop: 8 }}>
              <Typography className={classes.secondaryStat}>
                Total registered:{' '}
                {formatStat(result.statistics.total_households)} households
              </Typography>
              <Typography className={classes.contextLine}>
                {formatStat(result.statistics.total_members)} members
                {result.areas_matched > 0 &&
                  ` across ${formatStat(result.areas_matched)} barangays`}
              </Typography>
              <Typography className={classes.contextLine}>
                in Camarines Sur
              </Typography>
            </Box>

            {result.breakdown && (
              <>
                <Divider style={{ margin: '12px 0' }} />

                {/* Gender breakdown */}
                {(() => {
                  const items = aggregateBreakdown(result.breakdown, 'gender');
                  if (items.length === 0) {
                    return null;
                  }
                  const total = items.reduce((s, i) => s + i.count, 0);
                  return (
                    <Box style={{ marginBottom: 8 }}>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        By gender
                      </Typography>
                      {items.map(({ label, count }) => (
                        <Box key={label} className={classes.breakdownRow}>
                          <Typography className={classes.breakdownLabel}>
                            {label}
                          </Typography>
                          <Typography className={classes.breakdownValue}>
                            {formatStat(count)}
                            {total > 0 &&
                              ` (${Math.round((count / total) * 100)}%)`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                })()}

                {/* Age group breakdown */}
                {(() => {
                  const items = aggregateBreakdown(
                    result.breakdown,
                    'age_group',
                  );
                  if (items.length === 0) {
                    return null;
                  }
                  const total = items.reduce((s, i) => s + i.count, 0);
                  return (
                    <Box style={{ marginBottom: 8 }}>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        By age group
                      </Typography>
                      {items.map(({ label, count }) => (
                        <Box key={label} className={classes.breakdownRow}>
                          <Typography className={classes.breakdownLabel}>
                            {label}
                          </Typography>
                          <Typography className={classes.breakdownValue}>
                            {formatStat(count)}
                            {total > 0 &&
                              ` (${Math.round((count / total) * 100)}%)`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                })()}

                {hasSuppressionInBreakdown(result.breakdown) && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ fontStyle: 'italic', display: 'block' }}
                  >
                    Some categories hidden for privacy. Percentages may not
                    total 100%.
                  </Typography>
                )}
              </>
            )}

            <Button
              variant="outlined"
              color="primary"
              fullWidth
              style={{ marginTop: 16 }}
              onClick={() => setDialogOpen(true)}
            >
              Save as targeting zone
            </Button>
          </Box>
        )}
      </Paper>
      <SaveTargetingZoneDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message="Targeting zone saved to OpenSPP"
      />
    </>
  );
});

export default OpensppStatisticsPanel;
