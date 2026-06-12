import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff4081'
    },
    background: {
      default: '#0f0f13',
      paper: '#1a1a24'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255,255,255,0.7)'
    }
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    button: { textTransform: 'none' }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 16px',
          fontWeight: 600,
          fontFamily: "'Syne', sans-serif"
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)'
        }
      }
    }
  }
});

export default theme;
