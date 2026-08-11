import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      // examples/ and interfaces.ts have no runtime code to exercise
      include: ['src/**'],
      exclude: ['src/interfaces.ts'],
    },
  },
})
