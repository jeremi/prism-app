/**
 * Shared styles for OpenSPP panels (Query, Geofence).
 *
 * PRISM's MUI theme uses white text.primary and uppercase body2,
 * designed for dark panel backgrounds. These overrides ensure
 * readable text on the light-background OpenSPP panels.
 */
import { createStyles } from '@material-ui/core';
import { cyanBlue } from 'muiTheme';

const cyanBlueHover = '#52a1ac';

export const opensppPanelStyles = createStyles({
  /** Panel root container */
  panelRoot: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '360px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },

  /** Large title (panel header) */
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#222',
    letterSpacing: 'normal',
    textTransform: 'none' as const,
  },

  /** Smaller section title */
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#333',
    letterSpacing: 'normal',
    textTransform: 'none' as const,
  },

  /** Outlined button with readable text on light bg */
  outlinedButton: {
    textTransform: 'none' as const,
    letterSpacing: 'normal',
    fontSize: '0.8rem',
    color: '#333',
    borderColor: '#aaa',
  },

  /** Primary action button (Run Query, Create Geofence, etc.) */
  primaryButton: {
    textTransform: 'none' as const,
    letterSpacing: 'normal',
    fontSize: '0.8rem',
    backgroundColor: cyanBlue,
    color: '#fff',
    '&:hover': {
      backgroundColor: cyanBlueHover,
    },
    '&.Mui-disabled': {
      backgroundColor: '#ccc',
      color: '#888',
    },
  },

  /** Text field override for light background */
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

  /** Select/FormControl override for light background */
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

  /** Subtle status/info text */
  statusText: {
    fontSize: '0.78rem',
    fontStyle: 'italic',
    color: '#888',
    letterSpacing: 'normal',
    textTransform: 'none' as const,
  },

  /** Error message */
  errorText: {
    color: '#d32f2f',
    fontSize: '0.8rem',
    letterSpacing: 'normal',
    textTransform: 'none' as const,
  },
});

export { cyanBlue, cyanBlueHover };
