import { describe, it, expect, vi, beforeEach } from 'vitest'
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
      image:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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

describe('Ollama constructor', () => {
  it('uses default host when no config provided', () => {
    const client = new Ollama()
    expect((client as any).config.host).toBe('http://127.0.0.1:11434')
  })

  it('formats a provided host string', () => {
    const client = new Ollama({ host: 'example.com' })
    expect((client as any).config.host).toBe('http://example.com:11434')
  })

  it('leaves host empty when proxy is set', () => {
    const client = new Ollama({ proxy: true, host: 'https://custom.proxy.com' })
    expect((client as any).config.host).toBe('')
  })

  it('uses custom fetch when provided', () => {
    const customFetch = vi.fn()
    const client = new Ollama({ fetch: customFetch })
    expect((client as any).fetch).toBe(customFetch)
  })
})

describe('Ollama abort', () => {
  it('does not throw with no active streams', () => {
    const client = new Ollama()
    expect(() => client.abort()).not.toThrow()
  })
})

describe('Ollama GET methods (list, ps, version)', () => {
  let client: Ollama
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Ollama({ fetch: mockFetch })
  })

  it('list() hits GET /api/tags', async () => {
    const mockData = { models: [{ name: 'llama3' }] }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.list()

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('ps() hits GET /api/ps', async () => {
    const mockData = { models: [] }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.ps()

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/ps',
      expect.any(Object),
    )
  })

  it('version() hits GET /api/version', async () => {
    const mockData = { version: '0.1.0' }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.version()

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/version',
      expect.any(Object),
    )
  })
})

describe('Ollama POST methods (show, embed, embeddings)', () => {
  let client: Ollama
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Ollama({ fetch: mockFetch })
  })

  it('show() posts to /api/show', async () => {
    const mockData = { modelfile: 'FROM llama3' }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.show({ model: 'llama3' })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/show',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' }),
      }),
    )
  })

  it('embed() posts to /api/embed', async () => {
    const mockData = { embeddings: [[0.1, 0.2]] }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.embed({ model: 'llama3', input: 'hello' })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3', input: 'hello' }),
      }),
    )
  })

  it('embeddings() posts to /api/embeddings', async () => {
    const mockData = { embedding: [0.1, 0.2] }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.embeddings({ model: 'llama3', prompt: 'hello' })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3', prompt: 'hello' }),
      }),
    )
  })
})

describe('Ollama copy/delete methods', () => {
  let client: Ollama
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Ollama({ fetch: mockFetch })
  })

  it('copy() posts source and destination', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await client.copy({ source: 'llama3', destination: 'my-model' })

    expect(result).toEqual({ status: 'success' })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/copy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'llama3', destination: 'my-model' }),
      }),
    )
  })

  it('delete() sends DELETE to /api/delete', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await client.delete({ model: 'llama3' })

    expect(result).toEqual({ status: 'success' })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/delete',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ name: 'llama3' }),
      }),
    )
  })
})

describe('Ollama pull/push (non-streaming)', () => {
  let client: Ollama
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Ollama({ fetch: mockFetch })
  })

  it('pull() posts model name to /api/pull', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    )

    await client.pull({ model: 'llama3' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/pull',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'llama3', stream: false }),
      }),
    )
  })

  it('push() posts model name to /api/push', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    )

    await client.push({ model: 'llama3' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/push',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'llama3', stream: false }),
      }),
    )
  })
})

describe('Ollama create (browser, non-streaming)', () => {
  it('create() posts to /api/create', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    )
    const client = new Ollama({ fetch: mockFetch })

    await client.create({ name: 'my-model', from: 'llama3' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'my-model', from: 'llama3', stream: false }),
      }),
    )
  })
})

describe('Ollama webSearch/webFetch', () => {
  let client: Ollama
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new Ollama({ fetch: mockFetch })
  })

  it('webSearch() throws when query is empty', async () => {
    await expect(client.webSearch({ query: '' } as any)).rejects.toThrow(
      'Query is required',
    )
  })

  it('webSearch() posts to ollama.com', async () => {
    const mockData = { results: [] }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.webSearch({ query: 'test query' })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.com/api/web_search',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('webFetch() throws when url is empty', async () => {
    await expect(client.webFetch({ url: '' } as any)).rejects.toThrow('URL is required')
  })

  it('webFetch() posts to ollama.com', async () => {
    const mockData = { content: 'page content' }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await client.webFetch({ url: 'https://example.com' })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.com/api/web_fetch',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('Ollama encodeImage', () => {
  it('encodes Uint8Array to base64', async () => {
    const client = new Ollama()
    const input = new Uint8Array([72, 101, 108, 108, 111])
    const result = await (client as any).encodeImage(input)
    expect(result).toBe(btoa('Hello'))
  })

  it('returns a string input as-is', async () => {
    const client = new Ollama()
    const result = await (client as any).encodeImage('already-base64')
    expect(result).toBe('already-base64')
  })
})

describe('Ollama streaming', () => {
  it('generate() with stream returns an async iterator', async () => {
    const encoder = new TextEncoder()
    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"response":"Hello","done":false}\n'))
        controller.enqueue(encoder.encode('{"response":" world","done":true}\n'))
        controller.close()
      },
    })

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(bodyStream, { status: 200 }))

    const client = new Ollama({ fetch: mockFetch })

    const result = await client.generate({
      model: 'llama3',
      prompt: 'hi',
      stream: true,
    } as any)

    const messages = []
    for await (const msg of result) {
      messages.push(msg)
    }

    expect(messages).toHaveLength(2)
    expect(messages[0].response).toBe('Hello')
    expect(messages[1].done).toBe(true)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('generate() with stream throws if body is missing', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }))
    const client = new Ollama({ fetch: mockFetch })

    await expect(
      client.generate({ model: 'llama3', prompt: 'hi', stream: true } as any),
    ).rejects.toThrow('Missing body')
  })

  it('abort() clears active streams', async () => {
    const encoder = new TextEncoder()
    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"response":"chunk","done":false}\n'))
      },
    })

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(bodyStream, { status: 200 }))

    const client = new Ollama({ fetch: mockFetch })
    const result = await client.generate({
      model: 'llama3',
      prompt: 'hi',
      stream: true,
    } as any)

    expect((client as any).ongoingStreamedRequests).toHaveLength(1)

    client.abort()
    expect((client as any).ongoingStreamedRequests).toHaveLength(0)
  })
})

describe('Ollama image encoding in generate/chat', () => {
  it('generate() base64-encodes Uint8Array images', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({} as any)

    const imageData = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"

    await client.generate({
      model: 'test',
      prompt: 'describe this',
      images: [imageData],
    } as any)

    expect(spy).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        images: expect.arrayContaining([btoa('Hello')]),
      }),
    )
    spy.mockRestore()
  })

  it('chat() base64-encodes images in messages', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({} as any)

    const imageData = new Uint8Array([72, 101, 108, 108, 111])

    await client.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hi', images: [imageData] }] as any,
    })

    expect(spy).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            images: expect.arrayContaining([btoa('Hello')]),
          }),
        ]),
      }),
    )
    spy.mockRestore()
  })
})
