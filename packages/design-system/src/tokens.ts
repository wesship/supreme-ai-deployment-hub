export const tokens = {
  color: {
    space: '#05070B',
    carbon: '#111827',
    chrome: '#D9DEE6',
    titanium: '#5D6673',
    aiBlue: '#1E90FF',
    electricCyan: '#00D4FF',
    white: '#FFFFFF',
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
    24: '6rem',
  },
  radius: {
    button: '0.75rem',
    card: '1.25rem',
    dialog: '1.5rem',
    hero: '1.75rem',
    pill: '9999px',
  },
  shadow: {
    ambient: '0 18px 50px rgba(2, 8, 23, 0.35)',
    blue: '0 0 36px rgba(30, 144, 255, 0.28)',
    chrome: '0 18px 80px rgba(148, 163, 184, 0.16)',
  },
  motion: {
    fast: '150ms',
    standard: '250ms',
    deliberate: '500ms',
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
  typography: {
    display: 'Space Grotesk, Geist, Inter, system-ui, sans-serif',
    body: 'Inter, IBM Plex Sans, system-ui, sans-serif',
  },
} as const;

export type D3VONNTokens = typeof tokens;
