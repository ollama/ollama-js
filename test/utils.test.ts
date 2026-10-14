import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AbortableAsyncIterator, get, parseJSON } from '../src/utils'

describe('get Function Header Tests', () => {
  const mockFetch = vi.fn();
  const mockResponse = new Response(null, { status: 200 });

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(mockResponse);
  });

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': expect.stringMatching(/ollama-js\/.*/)
  };

  it('should use default headers when no headers provided', async () => {
    await get(mockFetch, 'http://example.com');
    
    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining(defaultHeaders)
    });
  });

  it('should handle Headers instance', async () => {
    const customHeaders = new Headers({
      'Authorization': 'Bearer token',
      'X-Custom': 'value'
    });

    await get(mockFetch, 'http://example.com', { headers: customHeaders });

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        ...defaultHeaders,
        'authorization': 'Bearer token',
        'x-custom': 'value'
      })
    });
  });

  it('should handle plain object headers', async () => {
    const customHeaders = {
      'Authorization': 'Bearer token',
      'X-Custom': 'value'
    };

    await get(mockFetch, 'http://example.com', { headers: customHeaders });

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        ...defaultHeaders,
        'Authorization': 'Bearer token',
        'X-Custom': 'value'
      })
    });
  });

  it('should not allow custom headers to override default User-Agent', async () => {
    const customHeaders = {
      'User-Agent': 'custom-agent'
    };

    await get(mockFetch, 'http://example.com', { headers: customHeaders });

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining({
        'User-Agent': expect.stringMatching(/ollama-js\/.*/)
      })
    });
  });

  it('should handle empty headers object', async () => {
    await get(mockFetch, 'http://example.com', { headers: {} });

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining(defaultHeaders)
    });
  });
});

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
});

describe('parseJSON reader cleanup', () => {
  function createStream(messages: object[]) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const message of messages) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(message) + '\n'))
        }
        controller.close()
      },
    })
  }

  it('releases the reader after reaching EOF', async () => {
    const body = createStream([{ text: 'hello' }])
    const messages = []
    for await (const message of parseJSON(body)) {
      messages.push(message)
    }
    expect(messages).toEqual([{ text: 'hello' }])
    expect(body.locked).toBe(false)
  })

  it('releases the reader when the consumer breaks early', async () => {
    const body = createStream([{ text: 'hello' }, { text: 'world' }])
    for await (const message of parseJSON(body)) {
      expect(message).toEqual({ text: 'hello' })
      break
    }
    expect(body.locked).toBe(false)
  })

  it('releases the reader and preserves a read error', async () => {
    const error = new Error('stream failed')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(error)
      },
    })
    await expect(parseJSON(body).next()).rejects.toBe(error)
    expect(body.locked).toBe(false)
  })

  it.each([{ done: true }, { status: 'success' }])(
    'releases the reader when the response iterator receives %j',
    async (message) => {
      const body = createStream([message])
      const response = new AbortableAsyncIterator(
        new AbortController(), parseJSON<object>(body), vi.fn(),
      )
      const messages = []
      for await (const part of response) {
        messages.push(part)
      }
      expect(messages).toEqual([message])
      expect(body.locked).toBe(false)
    },
  )

  it('releases the reader when the response iterator throws a server error', async () => {
    const body = createStream([{ error: 'model failed' }])
    const response = new AbortableAsyncIterator(
      new AbortController(), parseJSON<object>(body), vi.fn(),
    )
    await expect(response[Symbol.asyncIterator]().next()).rejects.toThrow('model failed')
    expect(body.locked).toBe(false)
  })
})
