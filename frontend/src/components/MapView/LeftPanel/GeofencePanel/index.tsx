import { memo, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { Add, Delete, Refresh } from '@material-ui/icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  opensppGeofencesSelector,
  opensppGeofencesLoadingSelector,
  fetchOpenSPPGeofences,
  createOpenSPPGeofence,
  deleteOpenSPPGeofence,
} from 'context/opensppStateSlice';
import useMapDraw from 'utils/useMapDraw';
import type { GeofenceType } from 'utils/openspp-types';
import {
  GEOFENCE_TYPE_COLORS,
  GEOFENCE_TYPE_LABELS,
  GEOFENCE_DEFAULT_COLOR,
} from 'utils/openspp-types';

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
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: '0.95rem',
      fontWeight: 600,
      color: '#222',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    headerButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.78rem',
      color: '#333',
    },
    card: {
      marginBottom: '8px',
    },
    cardContent: {
      padding: '12px !important',
      '&:last-child': {
        paddingBottom: '12px !important',
      },
    },
    cardTitle: {
      fontSize: '0.85rem',
      fontWeight: 600,
      color: '#333',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    chip: {
      fontSize: '0.7rem',
      height: '22px',
    },
    createForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
    },
    formTitle: {
      fontSize: '0.85rem',
      fontWeight: 600,
      color: '#333',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    formButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.8rem',
      color: '#333',
      borderColor: '#aaa',
    },
    createButton: {
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
    deleteButton: {
      textTransform: 'none' as const,
      letterSpacing: 'normal',
      fontSize: '0.78rem',
      color: '#d32f2f',
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
    geofenceList: {
      maxHeight: '400px',
      overflowY: 'auto',
    },
    areaInfo: {
      fontSize: '0.75rem',
      color: '#666',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    emptyText: {
      fontSize: '0.8rem',
      color: '#888',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
    drawnText: {
      fontSize: '0.78rem',
      color: '#888',
      letterSpacing: 'normal',
      textTransform: 'none' as const,
    },
  }),
);

const GeofencePanel = memo(() => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const geofences = useSelector(opensppGeofencesSelector);
  const loading = useSelector(opensppGeofencesLoadingSelector);
  const { isDrawing, drawnGeometry, clearDrawing, toggleDrawing } =
    useMapDraw();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [geofenceType, setGeofenceType] = useState<GeofenceType>('custom');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Load geofences on mount
  useEffect(() => {
    dispatch(fetchOpenSPPGeofences(undefined) as any);
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchOpenSPPGeofences(undefined) as any);
  }, [dispatch]);

  const handleCreate = useCallback(async () => {
    if (!name || !drawnGeometry) {
      return;
    }
    setCreating(true);
    try {
      await dispatch(
        createOpenSPPGeofence({
          name,
          description: description || undefined,
          geometry: drawnGeometry,
          geofence_type: geofenceType,
        }) as any,
      );
      setName('');
      setDescription('');
      setGeofenceType('custom');
      setShowCreateForm(false);
      clearDrawing();
    } finally {
      setCreating(false);
    }
  }, [dispatch, name, description, geofenceType, drawnGeometry, clearDrawing]);

  const handleDelete = useCallback(
    (id: number) => {
      dispatch(deleteOpenSPPGeofence(id) as any);
      setDeleteId(null);
    },
    [dispatch],
  );

  const handleToggleDraw = toggleDrawing;

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography className={classes.headerTitle}>Geofences</Typography>
        <Box>
          <Button
            size="small"
            className={classes.headerButton}
            startIcon={<Add style={{ color: '#555' }} />}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            New
          </Button>
          <Button
            size="small"
            className={classes.headerButton}
            startIcon={<Refresh style={{ color: '#555' }} />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Create form */}
      {showCreateForm && (
        <Box className={classes.createForm}>
          <Typography className={classes.formTitle}>Create Geofence</Typography>
          <TextField
            className={classes.inputField}
            label="Name"
            size="small"
            variant="outlined"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <TextField
            className={classes.inputField}
            label="Description"
            size="small"
            variant="outlined"
            value={description}
            onChange={e => setDescription(e.target.value)}
            multiline
            rows={2}
          />
          <FormControl variant="outlined" size="small" className={classes.selectField}>
            <InputLabel>Type</InputLabel>
            <Select
              value={geofenceType}
              onChange={e => setGeofenceType(e.target.value as GeofenceType)}
              label="Type"
            >
              {Object.entries(GEOFENCE_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            className={classes.formButton}
            onClick={handleToggleDraw}
          >
            {isDrawing
              ? 'Stop Drawing'
              : drawnGeometry
                ? 'Redraw Area'
                : 'Draw Area on Map'}
          </Button>
          {drawnGeometry && (
            <Typography className={classes.drawnText}>
              Area drawn
            </Typography>
          )}
          <Button
            variant="contained"
            size="small"
            className={classes.createButton}
            disabled={!name || !drawnGeometry || creating}
            onClick={handleCreate}
            startIcon={creating ? <CircularProgress size={16} style={{ color: '#fff' }} /> : <Add />}
          >
            {creating ? 'Creating...' : 'Create Geofence'}
          </Button>
        </Box>
      )}

      <Divider />

      {/* Geofence list */}
      {loading && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      )}

      <Box className={classes.geofenceList}>
        {geofences.map(gf => (
          <Card key={gf.id} className={classes.card} variant="outlined">
            <CardContent className={classes.cardContent}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography className={classes.cardTitle}>{gf.name}</Typography>
                <Chip
                  label={
                    GEOFENCE_TYPE_LABELS[gf.geofence_type] || gf.geofence_type
                  }
                  size="small"
                  className={classes.chip}
                  style={{
                    backgroundColor:
                      GEOFENCE_TYPE_COLORS[gf.geofence_type as GeofenceType] ||
                      GEOFENCE_DEFAULT_COLOR,
                    color: '#fff',
                  }}
                />
              </Box>
              <Typography className={classes.areaInfo}>
                Area: {gf.area_sqkm.toFixed(2)} km&sup2; |{' '}
                {gf.active ? 'Active' : 'Archived'}
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                className={classes.deleteButton}
                startIcon={<Delete style={{ color: '#d32f2f' }} />}
                onClick={() => setDeleteId(gf.id)}
              >
                Delete
              </Button>
            </CardActions>
          </Card>
        ))}
        {geofences.length === 0 && !loading && (
          <Typography className={classes.emptyText}>
            No geofences found
          </Typography>
        )}
      </Box>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Geofence</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to archive this geofence? This action can be
            undone by an administrator.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            onClick={() => deleteId !== null && handleDelete(deleteId)}
            color="secondary"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default GeofencePanel;
