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

function streamResponse(
  lines: string[],
  { neverClose = false }: { neverClose?: boolean } = {},
) {
  const encoder = new TextEncoder()
  return (_url: string, options?: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(line + '\n'))
        }
        if (!neverClose) {
          controller.close()
        }
        // behave like fetch: an aborted request signal errors the body
        options?.signal?.addEventListener('abort', () =>
          controller.error(
            new DOMException('The operation was aborted.', 'AbortError'),
          ),
        )
      },
    })
    return Promise.resolve(new Response(body, { status: 200 }))
  }
}

const streamingChatChunk =
  '{"model":"m","created_at":"t","message":{"role":"assistant","content":"hi"},"done":false}'

describe('Ollama ongoing streamed request tracking', () => {
  it('removes the stream from ongoingStreamedRequests after abort', async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(
        streamResponse([streamingChatChunk], { neverClose: true }),
      )
    const client = new Ollama({ fetch: mockFetch as any })

    const itr = await client.chat({ model: 'm', messages: [], stream: true })
    const iterator = itr[Symbol.asyncIterator]()
    await iterator.next()

    itr.abort()
    await expect(iterator.next()).rejects.toThrow()

    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })

  it('removes the stream when the server sends an error chunk', async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(streamResponse(['{"error":"boom"}']))
    const client = new Ollama({ fetch: mockFetch as any })

    const itr = await client.chat({ model: 'm', messages: [], stream: true })
    await expect(async () => {
      for await (const _ of itr) {
        // consume
      }
    }).rejects.toThrow('boom')

    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })

  it('removes the stream when it ends without a done message', async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(streamResponse([streamingChatChunk]))
    const client = new Ollama({ fetch: mockFetch as any })

    const itr = await client.chat({ model: 'm', messages: [], stream: true })
    await expect(async () => {
      for await (const _ of itr) {
        // consume
      }
    }).rejects.toThrow('Did not receive done or success response in stream.')

    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })

  it('removes the stream after a successful done response', async () => {
    const mockFetch = vi.fn().mockImplementation(
      streamResponse([
        streamingChatChunk,
        '{"model":"m","created_at":"t","message":{"role":"assistant","content":"bye"},"done":true}',
      ]),
    )
    const client = new Ollama({ fetch: mockFetch as any })

    const itr = await client.chat({ model: 'm', messages: [], stream: true })
    for await (const _ of itr) {
      // consume
    }

    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })

  it('keeps tracking a stream the consumer stopped iterating so abort() can still cancel it', async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(
        streamResponse([streamingChatChunk], { neverClose: true }),
      )
    const client = new Ollama({ fetch: mockFetch as any })

    const itr = await client.chat({ model: 'm', messages: [], stream: true })
    for await (const _ of itr) {
      break
    }

    // the request is still in-flight; it must stay registered so that
    // Ollama#abort() can still cancel it
    expect((client as any).ongoingStreamedRequests).toHaveLength(1)
    client.abort()
    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })
})
