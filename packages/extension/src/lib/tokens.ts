export const colors = {
  black: '#080810',        // ALL backgrounds — never use pure #000
  navy: '#0E0E1C',         // cards, inputs, secondary surfaces
  violet: '#7C6FFF',       // brand, CTAs, active states
  cyan: '#00E5FF',         // hover, connected indicator, focus rings
  textPrimary: '#EEEEF5',  // all important text — never pure white
  textSecondary: '#7878A0', // timestamps, labels, metadata
  pink: '#FF3C6E',         // errors, destructive, YouTube brand icon
  green: '#00E5AA',        // online dots, connected, positive states
  amber: '#FFB800',        // reconnecting, sync issues, warnings
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
} as const

export const radii = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
} as const

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '400ms ease',
} as const

export const shadows = {
  violet: '0 0 40px rgba(124, 111, 255, 0.25)',
  cyan: '0 0 30px rgba(0, 229, 255, 0.15)',
  card: '0 8px 32px rgba(0, 0, 0, 0.6)',
} as const
