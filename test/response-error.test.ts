import { describe, expect, it, vi } from 'vitest'
import * as nodeClient from '../src/index'
import * as browserClient from '../src/browser'

describe('public HTTP response errors', () => {
  it('exports the same error constructor from the Node and browser entry points', () => {
    expect(nodeClient.ResponseError).toBeTypeOf('function')
    expect(browserClient.ResponseError).toBe(nodeClient.ResponseError)
  })

  for (const [name, client] of [
    ['Node', nodeClient],
    ['browser', browserClient],
  ] as const) {
    it(`${name} exposes JSON HTTP failures as a public ResponseError`, async () => {
      const fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'model not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const ollama = new client.Ollama({ fetch })
      const error = await ollama
        .generate({ model: 'missing', prompt: 'hello' })
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(client.ResponseError)
      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({
        name: 'ResponseError',
        message: 'model not found',
        error: 'model not found',
        status_code: 404,
      })
    })
  }

  it('does not reclassify a network error as a ResponseError', async () => {
    const networkError = new TypeError('fetch failed')
    const ollama = new browserClient.Ollama({
      fetch: vi.fn().mockRejectedValue(networkError),
    })
    await expect(ollama.generate({ model: 'example', prompt: 'hello' })).rejects.toBe(
      networkError,
    )
  })
})
