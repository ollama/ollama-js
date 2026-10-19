import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  get,
  head,
  post,
  del,
  parseJSON,
  formatHost,
  AbortableAsyncIterator,
} from '../src/utils'

describe('get Function Header Tests', () => {
  const mockFetch = vi.fn()
  const mockResponse = new Response(null, { status: 200 })

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(mockResponse)
  })

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': expect.stringMatching(/ollama-js\/.*/),
  }

  it('should use default headers when no headers provided', async () => {
    await get(mockFetch, 'http://example.com')

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining(defaultHeaders),
    })
  })

  it('should handle Headers instance', async () => {
    const customHeaders = new Headers({
      Authorization: 'Bearer token',
      'X-Custom': 'value',
    })

    await get(mockFetch, 'http://example.com', { headers: customHeaders })

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        ...defaultHeaders,
        authorization: 'Bearer token',
        'x-custom': 'value',
      }),
    })
  })

  it('should handle plain object headers', async () => {
    const customHeaders = {
      Authorization: 'Bearer token',
      'X-Custom': 'value',
    }

    await get(mockFetch, 'http://example.com', { headers: customHeaders })

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        ...defaultHeaders,
        Authorization: 'Bearer token',
        'X-Custom': 'value',
      }),
    })
  })

  it('should not allow custom headers to override default User-Agent', async () => {
    const customHeaders = {
      'User-Agent': 'custom-agent',
    }

    await get(mockFetch, 'http://example.com', { headers: customHeaders })

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        'User-Agent': expect.stringMatching(/ollama-js\/.*/),
      }),
    })
  })

  it('should handle empty headers object', async () => {
    await get(mockFetch, 'http://example.com', { headers: {} })

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining(defaultHeaders),
    })
  })
})

describe('parseJSON UTF-8 multibyte character handling', () => {
  it('should correctly decode multibyte UTF-8 characters split across chunk boundaries', async () => {
    const encoder = new TextEncoder()

    // Create chunks where the 'ь' character (UTF-8: 0xD1 0x8C) is split
    const chunks = [
      new Uint8Array([...encoder.encode('{"text":"использоват'), 0xd1]),
      new Uint8Array([0x8c, ...encoder.encode('"}\n')]),
    ]

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    const itr = parseJSON<{ text: string }>(stream)
    const { value } = await itr.next()
    expect(value?.text).toBe('использовать')
  })
})

describe('formatHost', () => {
  it('returns default host for empty string', () => {
    expect(formatHost('')).toBe('http://127.0.0.1:11434')
  })

  it('prepends 127.0.0.1 for :port', () => {
    expect(formatHost(':8080')).toBe('http://127.0.0.1:8080')
  })

  it('adds http:// and default port', () => {
    expect(formatHost('localhost')).toBe('http://localhost:11434')
  })

  it('preserves port without protocol', () => {
    expect(formatHost('localhost:8080')).toBe('http://localhost:8080')
  })

  it('uses port 80 for http without port', () => {
    expect(formatHost('http://example.com')).toBe('http://example.com:80')
  })

  it('uses port 443 for https without port', () => {
    expect(formatHost('https://example.com')).toBe('https://example.com:443')
  })

  it('preserves port with protocol', () => {
    expect(formatHost('https://example.com:9000')).toBe('https://example.com:9000')
  })

  it('includes username in basic auth', () => {
    expect(formatHost('http://user@example.com')).toBe('http://user@example.com:80')
  })

  it('includes username and password in basic auth', () => {
    expect(formatHost('http://user:pass@example.com')).toBe(
      'http://user:pass@example.com:80',
    )
  })

  it('removes trailing slash', () => {
    expect(formatHost('http://example.com/path/')).toBe('http://example.com:80/path')
  })

  it('keeps pathname without trailing slash', () => {
    expect(formatHost('http://example.com/api')).toBe('http://example.com:80/api')
  })
})

describe('head function', () => {
  const mockFetch = vi.fn()
  const mockResponse = new Response(null, { status: 200 })

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(mockResponse)
  })

  it('sends HEAD with default headers', async () => {
    await head(mockFetch, 'http://example.com')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'HEAD',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      }),
    )
  })

  it('throws with status_code on error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    await expect(head(mockFetch, 'http://example.com')).rejects.toMatchObject({
      status_code: 404,
    })
  })
})

describe('post function', () => {
  const mockFetch = vi.fn()
  const mockResponse = new Response(null, { status: 200 })

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(mockResponse)
  })

  it('stringifies object body', async () => {
    await post(mockFetch, 'http://example.com', { key: 'value' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      }),
    )
  })

  it('passes string body through as-is', async () => {
    const body = 'raw string body'
    await post(mockFetch, 'http://example.com', body)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'POST',
        body,
      }),
    )
  })

  it('forwards abort signal', async () => {
    const controller = new AbortController()
    await post(mockFetch, 'http://example.com', { x: 1 }, { signal: controller.signal })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
      }),
    )
  })

  it('throws with status and message on JSON error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad Request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(post(mockFetch, 'http://example.com', { x: 1 })).rejects.toMatchObject({
      status_code: 400,
      message: 'Bad Request',
    })
  })
})

describe('del function', () => {
  const mockFetch = vi.fn()
  const mockResponse = new Response(null, { status: 200 })

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(mockResponse)
  })

  it('sends DELETE with JSON body', async () => {
    await del(mockFetch, 'http://example.com', { id: 123 })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ id: 123 }),
      }),
    )
  })

  it('sends DELETE without body', async () => {
    await del(mockFetch, 'http://example.com')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
  })

  it('throws with status_code on error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))

    await expect(del(mockFetch, 'http://example.com', { id: 1 })).rejects.toMatchObject({
      status_code: 403,
    })
  })
})

describe('parseJSON edge cases', () => {
  it('parses multiple objects from one chunk', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n{"b":2}\n'))
        controller.close()
      },
    })

    const itr = parseJSON(stream)
    const r1 = await itr.next()
    const r2 = await itr.next()
    const r3 = await itr.next()

    expect(r1.value).toEqual({ a: 1 })
    expect(r2.value).toEqual({ b: 2 })
    expect(r3.done).toBe(true)
  })

  it('parses trailing object without newline', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}\n{"b":2}'))
        controller.close()
      },
    })

    const itr = parseJSON(stream)
    const r1 = await itr.next()
    const r2 = await itr.next()
    const r3 = await itr.next()

    expect(r1.value).toEqual({ a: 1 })
    expect(r2.value).toEqual({ b: 2 })
    expect(r3.done).toBe(true)
  })

  it('warns on invalid JSON lines', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"valid":true}\nnot-json\n'))
        controller.close()
      },
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const itr = parseJSON(stream)
    const r1 = await itr.next()
    const r2 = await itr.next()

    expect(r1.value).toEqual({ valid: true })
    expect(r2.done).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith('invalid json: ', 'not-json')

    warnSpy.mockRestore()
  })

  it('returns nothing for empty stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })

    const itr = parseJSON(stream)
    const r = await itr.next()

    expect(r.done).toBe(true)
  })
})

describe('AbortableAsyncIterator', () => {
  it('yields messages and calls done on completion', async () => {
    const abortController = new AbortController()
    const doneCallback = vi.fn()

    async function* gen() {
      yield { value: 1 }
      yield { value: 2 }
      yield { done: true }
    }

    const iter = new AbortableAsyncIterator(abortController, gen(), doneCallback)

    const results = []
    for await (const m of iter) {
      results.push(m)
    }

    expect(results).toEqual([{ value: 1 }, { value: 2 }, { done: true }])
    expect(doneCallback).toHaveBeenCalledTimes(1)
  })

  it('calls done on success status', async () => {
    const abortController = new AbortController()
    const doneCallback = vi.fn()

    async function* gen() {
      yield { status: 'success' }
    }

    const iter = new AbortableAsyncIterator(abortController, gen(), doneCallback)

    const results = []
    for await (const m of iter) {
      results.push(m)
    }

    expect(results).toEqual([{ status: 'success' }])
    expect(doneCallback).toHaveBeenCalledTimes(1)
  })

  it('throws on error messages', async () => {
    const abortController = new AbortController()
    const doneCallback = vi.fn()

    async function* gen() {
      yield { error: 'something went wrong' }
    }

    const iter = new AbortableAsyncIterator(abortController, gen(), doneCallback)

    await expect(async () => {
      for await (const _ of iter) {
      }
    }).rejects.toThrow('something went wrong')

    expect(doneCallback).not.toHaveBeenCalled()
  })

  it('throws if stream ends without done or success', async () => {
    const abortController = new AbortController()
    const doneCallback = vi.fn()

    async function* gen() {
      yield { value: 1 }
    }

    const iter = new AbortableAsyncIterator(abortController, gen(), doneCallback)

    await expect(async () => {
      for await (const _ of iter) {
      }
    }).rejects.toThrow('Did not receive done or success response in stream.')

    expect(doneCallback).not.toHaveBeenCalled()
  })

  it('abort() triggers the AbortController', () => {
    const abortController = new AbortController()
    const abortSpy = vi.spyOn(abortController, 'abort')
    const doneCallback = vi.fn()

    async function* gen() {
      yield { value: 1 }
    }

    const iter = new AbortableAsyncIterator(abortController, gen(), doneCallback)
    iter.abort()

    expect(abortSpy).toHaveBeenCalledTimes(1)
  })
})

describe('normalizeHeaders array format', () => {
  it('handles array-form headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const customHeaders = [
      ['X-Custom', 'value'],
      ['Authorization', 'Bearer token'],
    ]

    await get(mockFetch, 'http://example.com', { headers: customHeaders })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom': 'value',
          Authorization: 'Bearer token',
        }),
      }),
    )
  })
})

describe('checkOk error paths', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('uses text body for non-JSON errors', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Plain text error', { status: 500 }))

    await expect(get(mockFetch, 'http://example.com')).rejects.toMatchObject({
      status_code: 500,
      message: 'Plain text error',
    })
  })

  it('keeps default message when JSON parse fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('not valid json', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(get(mockFetch, 'http://example.com')).rejects.toMatchObject({
      status_code: 500,
    })
  })
})

describe('parseJSON buffer flush', () => {
  it('warns on invalid JSON in remaining buffer', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"valid":true}\ninvalid-no-newline'))
        controller.close()
      },
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const itr = parseJSON(stream)
    const r1 = await itr.next()
    const r2 = await itr.next()

    expect(r1.value).toEqual({ valid: true })
    expect(r2.done).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith('invalid json: ', 'invalid-no-newline')

    warnSpy.mockRestore()
  })
})

describe('ollama.com API key', () => {
  const originalApiKey = process.env.OLLAMA_API_KEY

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.OLLAMA_API_KEY = originalApiKey
    } else {
      delete process.env.OLLAMA_API_KEY
    }
  })

  it('adds Bearer token from OLLAMA_API_KEY', async () => {
    process.env.OLLAMA_API_KEY = 'test-secret-key'

    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await get(mockFetch, 'https://ollama.com/api/web_search')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.com/api/web_search',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-secret-key',
        }),
      }),
    )
  })

  it('skips auth header when OLLAMA_API_KEY is unset', async () => {
    delete process.env.OLLAMA_API_KEY

    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await get(mockFetch, 'https://ollama.com/api/web_search')

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].headers).not.toHaveProperty('Authorization')
  })

  it('skips auth header for non-ollama.com hosts', async () => {
    process.env.OLLAMA_API_KEY = 'test-secret-key'

    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await get(mockFetch, 'http://127.0.0.1:11434/api/tags')

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].headers).not.toHaveProperty('Authorization')
  })
})
