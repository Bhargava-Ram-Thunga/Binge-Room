export const ENV = {
  VITE_API_URL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  VITE_WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:4001',
} as const;
