import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get, parseJSON } from '../src/utils'

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
