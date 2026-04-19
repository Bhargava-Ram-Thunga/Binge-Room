import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    typecheck: {
      enabled: true,
    },
    coverage: {
      reporter: ['text', 'json'],
      exclude: ['node_modules', 'dist'],
    },
  },
})
