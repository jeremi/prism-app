import { memo, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { useSelector } from 'react-redux';
import { opensppStatsSelector } from 'context/opensppStatsSlice';
import { OPENSPP_API_URL } from 'utils/constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    typeLabel: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
      marginBottom: theme.spacing(2),
    },
  }),
);

const SaveTargetingZoneDialog = memo(({ open, onClose, onSaved }: Props) => {
  const classes = useStyles();
  const { selectedGeometry } = useSelector(opensppStatsSelector);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !selectedGeometry) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${OPENSPP_API_URL}/geofences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Feature',
          geometry: selectedGeometry,
          properties: {
            name: name.trim(),
            description: description.trim() || undefined,
            geofence_type: 'targeting_area',
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setName('');
      setDescription('');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save targeting zone.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save as targeting zone</DialogTitle>
      <DialogContent>
        <Typography className={classes.typeLabel}>
          Type: Targeting area
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="Name"
          fullWidth
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Typhoon Mawar - Bicol Flood Zone"
          disabled={saving}
        />
        <TextField
          margin="dense"
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          disabled={saving}
        />
        {error && (
          <Typography color="error" variant="body2" style={{ marginTop: 8 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving || !name.trim()}
        >
          {saving ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export default SaveTargetingZoneDialog;
