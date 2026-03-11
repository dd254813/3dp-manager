import type { PaletteMode } from '@mui/material';

const lightPalette = {
  primary: {
    main: '#1395de',
    light: '#60a5fa',
    dark: '#1e40af',
  },
  secondary: {
    main: '#7c3aed',
  },
  background: {
    default: '#f3f4f6',
    paper: '#ffffff',
  },
  text: {
    primary: '#111827',
    secondary: '#6b7280',
  },
};

const darkPalette = {
  primary: {
    main: '#1395de',
    light: '#60a5fa',
    dark: '#1d4ed8',
  },
  secondary: {
    main: '#8b5cf6',
  },
  background: {
    default: '#0B0F19',
    paper: '#111827',
  },
  text: {
    primary: '#f9fafb',
    secondary: '#9ca3af',
  },
};

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light' ? lightPalette : darkPalette),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: {
      textTransform: 'none' as const,
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: mode === 'dark' ? '#374151 #111827' : '#d1d5db #f3f4f6',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: 'transparent',
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? '#374151' : '#d1d5db',
            minHeight: 24,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: mode === 'dark' ? '#4b5563' : '#9ca3af',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: mode === 'dark' ? '#2563eb' : '#1d4ed8',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: mode === 'light'
            ? '0px 2px 4px -1px rgba(0,0,0,0.05), 0px 4px 6px -1px rgba(0,0,0,0.05)'
            : '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 6px -1px rgba(0,0,0,0.2)',
          border: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #374151',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: mode === 'light' ? '#e5e7eb' : '#374151',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: mode === 'light' ? '#9ca3af' : '#6b7280',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(17, 24, 39, 0.8)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${mode === 'light' ? '#e5e7eb' : '#374151'}`,
          boxShadow: 'none',
          color: mode === 'light' ? '#111827' : '#f9fafb',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": {
            borderBottom: 0,
          },
        }
      }
    }
  },
});