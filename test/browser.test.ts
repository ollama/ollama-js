import { describe, it, expect, vi } from 'vitest'
import { Ollama } from '../src/browser'
import type { ChatResponse, GenerateResponse } from '../src/interfaces'

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
