import { describe, expect, it, vi } from 'vitest'
import { Ollama } from '../src/browser'
import { AbortableAsyncIterator } from '../src/utils'

class InspectableOllama extends Ollama {
  get ongoingRequestCount() {
    return this.ongoingStreamedRequests.length
  }
}

function createClient(messages: object[] = [], end: 'close' | 'hold' | Error = 'hold') {
  const signals: AbortSignal[] = []
  const client = new InspectableOllama({
    fetch: async (_input, init) => {
      const signal = init!.signal as AbortSignal
      signals.push(signal)
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            signal.addEventListener('abort', () => {
              controller.error(new DOMException('Aborted', 'AbortError'))
            })
            for (const message of messages) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(message) + '\n'))
            }
            if (end === 'close') controller.close()
            if (end instanceof Error) controller.error(end)
          },
        }),
      )
    },
  })
  return { client, signals }
}

async function consume(stream: AsyncIterable<object>) {
  const messages: object[] = []
  for await (const message of stream) messages.push(message)
  return messages
}

const request = { model: 'dummy', stream: true as const }

describe('streamed request cleanup', () => {
  it.each([{ done: true }, { status: 'success' }])(
    'unregisters a completed %j response without aborting it',
    async (message) => {
      const { client, signals } = createClient([message])
      const stream = await client.generate(request)
      expect(client.ongoingRequestCount).toBe(1)
      await expect(consume(stream)).resolves.toEqual([message])
      expect(client.ongoingRequestCount).toBe(0)
      client.abort()
      expect(signals[0].aborted).toBe(false)
    },
  )

  it('aborts and unregisters a server error while preserving its message', async () => {
    const { client, signals } = createClient([{ error: 'server failed' }])
    const stream = await client.generate(request)
    await expect(consume(stream)).rejects.toThrow('server failed')
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('unregisters a stream that ends without a completion response', async () => {
    const { client, signals } = createClient([{ response: 'partial' }], 'close')
    await expect(consume(await client.generate(request))).rejects.toThrow(
      'Did not receive done or success response in stream.',
    )
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('unregisters a failed reader and rethrows the original error', async () => {
    const error = new Error('reader failed')
    const { client, signals } = createClient([], error)
    await expect(consume(await client.generate(request))).rejects.toBe(error)
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('unregisters an individually aborted pending stream', async () => {
    const { client, signals } = createClient()
    const stream = await client.generate(request)
    const result = consume(stream)
    stream.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('unregisters a stream aborted before iteration, including repeated aborts', async () => {
    const { client, signals } = createClient()
    const stream = await client.generate(request)
    stream.abort()
    stream.abort()
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
    await expect(consume(stream)).rejects.toMatchObject({ name: 'AbortError' })
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('keeps an early consumer break registered for client-wide cancellation', async () => {
    const { client, signals } = createClient([{ response: 'partial' }])
    for await (const message of await client.generate(request)) {
      expect(message).toEqual({ response: 'partial' })
      break
    }
    expect(client.ongoingRequestCount).toBe(1)
    expect(signals[0].aborted).toBe(false)
    client.abort()
    expect(signals[0].aborted).toBe(true)
    expect(client.ongoingRequestCount).toBe(0)
  })

  it('aborts every concurrent stream even when abort unregisters it immediately', async () => {
    const { client, signals } = createClient()
    const streams = await Promise.all([
      client.generate(request),
      client.generate(request),
      client.generate(request),
    ])
    const results = streams.map(consume)
    client.abort()
    expect(signals.map((signal) => signal.aborted)).toEqual([true, true, true])
    expect(client.ongoingRequestCount).toBe(0)
    await expect(Promise.allSettled(results)).resolves.toEqual(
      signals.map(() => ({
        status: 'rejected',
        reason: expect.objectContaining({ name: 'AbortError' }),
      })),
    )
  })

  it('does not unregister other active streams when one fails', async () => {
    const { client, signals } = createClient([{ error: 'server failed' }])
    const failed = await client.generate(request)
    await client.generate(request)
    await expect(consume(failed)).rejects.toThrow('server failed')
    expect(client.ongoingRequestCount).toBe(1)
    expect(signals.map((signal) => signal.aborted)).toEqual([true, false])
    client.abort()
    expect(signals[1].aborted).toBe(true)
  })
})

describe('AbortableAsyncIterator cleanup callback', () => {
  it.each(['complete', 'abort', 'error'] as const)(
    'runs once after %s and repeated aborts',
    async (end) => {
      const done = vi.fn()
      const controller = new AbortController()
      async function* messages() {
        if (end === 'error') throw new Error('failed')
        yield { done: true }
      }
      const stream = new AbortableAsyncIterator(controller, messages(), done)
      if (end === 'abort') stream.abort()
      if (end === 'error') await expect(consume(stream)).rejects.toThrow('failed')
      else await consume(stream)
      stream.abort()
      stream.abort()
      expect(done).toHaveBeenCalledTimes(1)
    },
  )
})
