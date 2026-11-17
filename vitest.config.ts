import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      ollama: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
})
