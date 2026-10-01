import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ollama } from '../src/browser'

function mockClient() {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  const client = new Ollama({ fetch: fetchMock as unknown as typeof fetch })
  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
  return { client, sentBody }
}

describe('unsupported options', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  afterEach(() => {
    warn.mockClear()
  })

  it('are dropped from chat options with a warning', async () => {
    const { client, sentBody } = mockClient()
    await client.chat({
      model: 'dummy',
      messages: [{ role: 'user', content: 'hi' }],
      options: { typical_p: 0.5, temperature: 0 },
    })
    expect(sentBody().options).toEqual({ temperature: 0 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('typical_p'))
  })

  it('are dropped from embed options with a warning', async () => {
    const { client, sentBody } = mockClient()
    await client.embed({
      model: 'dummy',
      input: 'hi',
      options: { mirostat: 2, num_ctx: 8 },
    })
    expect(sentBody().options).toEqual({ num_ctx: 8 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mirostat'))
  })

  it('are dropped from create parameters with a warning', async () => {
    const { client, sentBody } = mockClient()
    await client.create({
      model: 'dummy',
      from: 'base',
      parameters: { penalize_newline: true, stop: ['x'] },
    })
    expect(sentBody().parameters).toEqual({ stop: ['x'] })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('penalize_newline'))
  })

  it('leave unknown options in place without a warning', async () => {
    const { client, sentBody } = mockClient()
    await client.generate({
      model: 'dummy',
      prompt: 'hi',
      options: { future_option: 1, min_p: 0.05 } as Record<string, unknown>,
    })
    expect(sentBody().options).toEqual({ future_option: 1, min_p: 0.05 })
    expect(warn).not.toHaveBeenCalled()
  })
})
