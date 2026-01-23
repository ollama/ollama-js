import { describe, it, expect, vi } from 'vitest'
import { Ollama } from '../src/browser'
import type { ChatResponse, GenerateResponse } from '../src/interfaces'
import type { AbortableAsyncIterator } from '../src/browser'

describe('AbortableAsyncIterator type export', () => {
  it('should be importable from browser module', () => {
    const typeCheck = (_: AbortableAsyncIterator<ChatResponse> | null) => {}
    typeCheck(null)
    expect(true).toBe(true)
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

describe('Ollama image generation request fields', () => {
  it('forwards image generation parameters in generate requests', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({} as GenerateResponse)

    await client.generate({
      model: 'dummy-image',
      prompt: 'a sunset over mountains',
      width: 1024,
      height: 768,
      steps: 20,
    })

    expect(spy).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        model: 'dummy-image',
        prompt: 'a sunset over mountains',
        width: 1024,
        height: 768,
        steps: 20,
      }),
    )
  })

  it('handles image generation response with image field', async () => {
    const mockResponse: GenerateResponse = {
      model: 'dummy-image',
      created_at: new Date(),
      done: true,
      done_reason: 'stop',
      context: [],
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 10,
      prompt_eval_duration: 50,
      eval_count: 0,
      eval_duration: 0,
      image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }

    const client = new Ollama()
    vi.spyOn(client as any, 'processStreamableRequest').mockResolvedValue(mockResponse)

    const response = await client.generate({
      model: 'dummy-image',
      prompt: 'a sunset',
    })

    expect(response.image).toBeDefined()
    expect(response.done).toBe(true)
  })

  it('handles streaming progress fields for image generation', async () => {
    const mockResponse: GenerateResponse = {
      model: 'dummy-image',
      created_at: new Date(),
      done: false,
      done_reason: '',
      context: [],
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: 0,
      prompt_eval_duration: 0,
      eval_count: 0,
      eval_duration: 0,
      completed: 5,
      total: 20,
    }

    const client = new Ollama()
    vi.spyOn(client as any, 'processStreamableRequest').mockResolvedValue(mockResponse)

    const response = await client.generate({
      model: 'dummy-image',
      prompt: 'a sunset',
    })

    expect(response.completed).toBe(5)
    expect(response.total).toBe(20)
    expect(response.done).toBe(false)
  })
})
