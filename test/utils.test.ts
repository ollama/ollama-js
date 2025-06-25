import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from '../src/utils'
import { Agent } from 'undici';

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
      headers: expect.objectContaining(defaultHeaders),
      dispatcher: expect.any(Agent),
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
      }),
      dispatcher: expect.any(Agent),
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
      }),
      dispatcher: expect.any(Agent),
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
      }),
      dispatcher: expect.any(Agent),
    });
  });

  it('should handle empty headers object', async () => {
    await get(mockFetch, 'http://example.com', { headers: {} });

    expect(mockFetch).toHaveBeenCalledWith('http://example.com', {
      headers: expect.objectContaining(defaultHeaders),
      dispatcher: expect.any(Agent),
    });
  });
});