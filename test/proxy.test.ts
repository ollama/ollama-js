import { describe, expect, it, vi } from 'vitest'
import { Ollama } from '../src/browser'

describe('browser proxy requests', () => {
  it('does not log URL parse errors for relative request URLs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: 'dummy',
            created_at: '2026-01-01T00:00:00Z',
            message: { role: 'assistant', content: 'hi' },
            done: true,
            done_reason: 'stop',
          }),
        ),
      )
      const client = new Ollama({ proxy: true, fetch })

      await client.chat({ model: 'dummy', messages: [{ role: 'user', content: 'hi' }] })

      expect(fetch).toHaveBeenCalledWith('/api/chat', expect.anything())
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('still adds OLLAMA_API_KEY for absolute requests to ollama.com', async () => {
    vi.stubEnv('OLLAMA_API_KEY', 'synthetic-key')
    try {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ models: [] })))
      const client = new Ollama({ host: 'https://ollama.com', fetch })

      await client.list()

      const headers = fetch.mock.calls[0][1].headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer synthetic-key')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
