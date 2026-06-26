/**
 * VoteChain design tokens — JS/TS export (PROD-006)
 * Mirrors the values in styles/tokens.css for use in charting libs,
 * dynamic styles, and tests.
 */

export const color = {
  brand: {
    50:  '#e8f0fb',
    100: '#c5d9f5',
    200: '#9dbfee',
    300: '#74a4e7',
    400: '#4d8be0',
    500: '#0057b8',
    600: '#004494',
    700: '#003270',
    800: '#00214d',
    900: '#001129',
  },
  neutral: {
    0:   '#ffffff',
    50:  '#f9f9f9',
    100: '#f0f0f0',
    200: '#e0e0e0',
    300: '#c8c8c8',
    400: '#a0a0a0',
    500: '#767676',
    600: '#595959',
    700: '#3d3d3d',
    800: '#1a1a1a',
    900: '#0a0a0a',
  },
  status: {
    success: '#1a6e1a',
    warning: '#7a4f00',
    error:   '#b91c1c',
    info:    '#0057b8',
  },
  dark: {
    bg:            '#121212',
    surface:       '#1e1e1e',
    surfaceRaised: '#2a2a2a',
    primary:       '#5ba3ff',
    textPrimary:   '#e8e8e8',
    textSecondary: '#b0b0b0',
    textMuted:     '#8a8a8a',
    border:        '#8a8a8a',
    borderSubtle:  '#3a3a3a',
  },
} as const;

export const font = {
  sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
} as const;

export const text = {
  xs:   '0.75rem',
  sm:   '0.875rem',
  base: '1rem',
  md:   '1.125rem',
  lg:   '1.25rem',
  xl:   '1.5rem',
  '2xl':'1.875rem',
  '3xl':'2.25rem',
  '4xl':'3rem',
} as const;

export const space = {
  0:  '0',
  1:  '0.25rem',
  2:  '0.5rem',
  3:  '0.75rem',
  4:  '1rem',
  5:  '1.25rem',
  6:  '1.5rem',
  8:  '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const radius = {
  sm:   '0.25rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  xl:   '1rem',
  '2xl':'1.5rem',
  full: '9999px',
} as const;
