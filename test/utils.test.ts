import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get, getProcessorUsage, parseJSON } from '../src/utils'
import { getProcessorUsage as browserGetProcessorUsage } from '../src/browser'
import { getProcessorUsage as nodeGetProcessorUsage } from '../src/index'

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

describe('getProcessorUsage', () => {
  it('reports 100% CPU when nothing is in VRAM', () => {
    expect(getProcessorUsage({ size: 1000, size_vram: 0 })).toEqual({ cpu: 100, gpu: 0 })
  })

  it('reports 100% GPU when the whole model is in VRAM', () => {
    expect(getProcessorUsage({ size: 1000, size_vram: 1000 })).toEqual({ cpu: 0, gpu: 100 })
  })

  it('splits a partially offloaded model like ollama ps', () => {
    expect(getProcessorUsage({ size: 1000, size_vram: 520 })).toEqual({ cpu: 48, gpu: 52 })
  })

  it('rounds the CPU share and keeps the total at 100', () => {
    expect(getProcessorUsage({ size: 3, size_vram: 1 })).toEqual({ cpu: 67, gpu: 33 })
    expect(getProcessorUsage({ size: 200, size_vram: 101 })).toEqual({ cpu: 50, gpu: 50 })
  })

  it('returns undefined when VRAM exceeds the model size', () => {
    expect(getProcessorUsage({ size: 1000, size_vram: 1001 })).toBeUndefined()
  })

  it('returns undefined when the model size is zero but VRAM is not', () => {
    expect(getProcessorUsage({ size: 0, size_vram: 10 })).toBeUndefined()
  })

  it('returns undefined when size_vram is missing, as in list() results', () => {
    const model = { size: 1000 } as { size: number; size_vram: number }
    expect(getProcessorUsage(model)).toBeUndefined()
  })

  it('is exported from the node and browser entry points', () => {
    expect(nodeGetProcessorUsage).toBe(getProcessorUsage)
    expect(browserGetProcessorUsage).toBe(getProcessorUsage)
  })
})
