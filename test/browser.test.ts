import { describe, it, expect, vi } from 'vitest'
import { Ollama } from '../src/browser'
import type { ChatResponse, GenerateRequest, GenerateResponse } from '../src/interfaces'
import type { AbortableAsyncIterator } from '../src/utils'

describe('Generic stream parameter typing', () => {
  it('allows boolean stream parameter in wrapper function', async () => {
    const client = new Ollama()
    vi.spyOn(client as any, 'processStreamableRequest').mockResolvedValue({} as GenerateResponse)

    const wrapper = async (request: GenerateRequest, stream: boolean) => {
      return client.generate({ ...request, stream })
    }

    const result = await wrapper({ model: 'test', prompt: 'hello' }, false)
    expect(result).toBeDefined()
  })

  it('returns correct type for stream: true', async () => {
    const client = new Ollama()
    const mockIterator = {} as AbortableAsyncIterator<GenerateResponse>
    vi.spyOn(client as any, 'processStreamableRequest').mockResolvedValue(mockIterator)

    const result = await client.generate({ model: 'test', prompt: 'hello', stream: true })
    expect(result).toBe(mockIterator)
  })

  it('returns correct type for stream: false', async () => {
    const client = new Ollama()
    const mockResponse = { model: 'test' } as GenerateResponse
    vi.spyOn(client as any, 'processStreamableRequest').mockResolvedValue(mockResponse)

    const result = await client.generate({ model: 'test', prompt: 'hello', stream: false })
    expect(result).toBe(mockResponse)
  })
})

describe('Ollama logprob request fields', () => {
  it('forwards logprob settings in generate requests', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({} as GenerateResponse)

    await client.generate({
      model: 'dummy',
      prompt: 'Hello',
      logprobs: true,
      top_logprobs: 5,
    })

    expect(spy).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        logprobs: true,
        top_logprobs: 5,
      }),
    )
  })

  it('forwards logprob settings in chat requests', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({} as ChatResponse)

    await client.chat({
      model: 'dummy',
      messages: [{ role: 'user', content: 'hi' }],
      logprobs: true,
      top_logprobs: 3,
    })

    expect(spy).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({
        logprobs: true,
        top_logprobs: 3,
      }),
    )
  })
})
