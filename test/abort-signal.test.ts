import { describe, it, expect, vi } from 'vitest'
import { Ollama } from '../src/browser'

/**
 * A fetch stand-in that behaves like the real thing with respect to
 * AbortSignal: it never resolves on its own, and rejects with an
 * AbortError as soon as the given signal fires.
 */
function createAbortAwareFetch() {
  const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      }
      // otherwise: never resolves, simulating a slow/hanging server
    })
  })
  return fetch
}

describe('external AbortSignal for chat/generate (issue #274)', () => {
  it('rejects immediately when an external signal aborts a non-streaming generate() call', async () => {
    const fetch = createAbortAwareFetch()
    const client = new Ollama({ fetch: fetch as any })
    const controller = new AbortController()

    const promise = client.generate(
      { model: 'dummy', prompt: 'hello' },
      { signal: controller.signal },
    )

    controller.abort()

    await expect(promise).rejects.toThrow(/abort/i)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects immediately when an external signal aborts a streaming chat() call', async () => {
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    })
    const client = new Ollama({ fetch: fetch as any })
    const controller = new AbortController()

    const promise = client.chat(
      { model: 'dummy', messages: [{ role: 'user', content: 'hi' }], stream: true },
      { signal: controller.signal },
    )

    controller.abort()

    await expect(promise).rejects.toThrow(/abort/i)
  })

  it('rejects immediately if the external signal is already aborted before the call', async () => {
    const fetch = createAbortAwareFetch()
    const client = new Ollama({ fetch: fetch as any })
    const controller = new AbortController()
    controller.abort()

    await expect(
      client.generate({ model: 'dummy', prompt: 'hello' }, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i)
  })

  it('still works with no signal passed at all (backward compatible)', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({ done: true })

    await client.generate({ model: 'dummy', prompt: 'hello' })

    expect(spy).toHaveBeenCalledWith('generate', expect.any(Object))
  })

  it('forwards options.signal through to processStreamableRequest', async () => {
    const client = new Ollama()
    const spy = vi
      .spyOn(client as any, 'processStreamableRequest')
      .mockResolvedValue({ done: true })
    const controller = new AbortController()

    await client.chat(
      { model: 'dummy', messages: [{ role: 'user', content: 'hi' }] },
      { signal: controller.signal },
    )

    expect(spy).toHaveBeenCalledWith('chat', expect.any(Object), controller.signal)
  })
})
