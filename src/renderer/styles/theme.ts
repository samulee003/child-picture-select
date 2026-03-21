/**
 * Modern Dark Design System for Find My Kid Application
 * Dark glassmorphism with subtle gradients and high contrast
 */

export const theme = {
  // Color palette
  colors: {
    primary: {
      50: '#f0f4f8',
      100: '#dbe7f0',
      200: '#bad1e4',
      300: '#8db5d4',
      400: '#5c96c1',
      500: '#3a7baa',
      600: '#28628e',
      700: '#214e73',
      800: '#1e4361',
      900: '#004060',
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    neutral: {
      0: '#ffffff',
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
    },
  },

  // Dark-mode gradients
  gradients: {
    primary: 'linear-gradient(135deg, #5c96c1 0%, #004060 100%)',
    secondary: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
    card: 'linear-gradient(145deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.03) 100%)',
    background: 'linear-gradient(135deg, #0c1220 0%, #111827 50%, #0f172a 100%)',
  },

  typography: {
    fontFamily: {
      sans: [
        'Noto Sans TC',
        'PingFang TC',
        'Microsoft JhengHei',
        'system-ui',
        '-apple-system',
        'Segoe UI',
        'sans-serif',
      ],
      mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
  },

  borderRadius: {
    none: '0',
    sm: '0.375rem',
    base: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '2.5rem',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    base: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.15)',
    xl: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
    '2xl': '0 35px 60px -15px rgba(0, 0, 0, 0.5)',
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    glow: '0 0 20px rgba(92, 150, 193, 0.3)',
  },

  transition: {
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    slower: '500ms',
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
};

// Modern component styles — dark glassmorphism
export const modernStyles = {
  glassCard: {
    background: theme.gradients.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.glass,
  },

  button: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
      padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
      fontFamily: theme.typography.fontFamily.sans.join(', '),
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      lineHeight: theme.typography.lineHeight.tight,
      borderRadius: theme.borderRadius.full,
      border: '1px solid transparent',
      cursor: 'pointer',
      transition: `all ${theme.transition.base} ${theme.easing.easeInOut}`,
      textDecoration: 'none',
      outline: 'none',
      position: 'relative',
      overflow: 'hidden',
    },
    primary: {
      background: theme.gradients.primary,
      color: theme.colors.neutral[0],
      boxShadow: theme.shadows.base,
      transform: 'translateY(0)',
    },
    primaryHover: {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.md,
      background: theme.colors.primary[500],
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: theme.colors.neutral[200],
      borderColor: 'rgba(255, 255, 255, 0.15)',
      boxShadow: theme.shadows.sm,
    },
    secondaryHover: {
      background: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.25)',
      transform: 'translateY(-1px)',
    },
    success: {
      background: theme.gradients.success,
      color: theme.colors.neutral[0],
      boxShadow: theme.shadows.base,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.neutral[300],
    },
    ghostHover: {
      background: 'rgba(255, 255, 255, 0.06)',
      color: theme.colors.neutral[100],
    },
  },

  input: {
    base: {
      width: '100%',
      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
      fontFamily: theme.typography.fontFamily.sans.join(', '),
      fontSize: theme.typography.fontSize.base,
      lineHeight: theme.typography.lineHeight.normal,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: theme.borderRadius.md,
      color: theme.colors.neutral[100],
      transition: `all ${theme.transition.base} ${theme.easing.easeInOut}`,
      outline: 'none',
    },
    focus: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: theme.colors.primary[400],
      boxShadow: `0 0 0 3px rgba(92, 150, 193, 0.25)`,
    },
    textarea: {
      minHeight: '120px',
      resize: 'vertical' as const,
    },
  },

  container: {
    minHeight: '100vh',
    background: theme.gradients.background,
    backgroundSize: '200% 200%',
    padding: theme.spacing[6],
    position: 'relative',
    overflow: 'hidden',
  },

  layout: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing[6],
  },
};

// CSS keyframes for animations
export const animations = `
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

export default theme;
