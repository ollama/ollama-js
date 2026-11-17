import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  generate: vi.fn(),
  abort: vi.fn(),
  webSearch: vi.fn(),
  webFetch: vi.fn(),
}))
vi.mock('ollama', () => ({
  default: mocks,
  Ollama: class {
    chat = mocks.chat
    generate = mocks.generate
    abort = mocks.abort
    webSearch = mocks.webSearch
    webFetch = mocks.webFetch
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('OLLAMA_API_KEY', 'example-test-key')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it.each([
  '../examples/tools/multi-tool.ts',
  '../examples/websearch/websearch-tools.ts',
  '../examples/websearch/gpt-oss-browser-tools.ts',
])('preserves a complete streamed assistant turn in %s', async (example) => {
  const requests: any[] = []
  mocks.chat.mockImplementation(async (request) => {
    requests.push(structuredClone(request.messages))
    return (async function* () {
      if (requests.length > 1) {
        yield { message: { role: 'assistant', content: 'Done' } }
        return
      }
      yield {
        message: {
          role: 'assistant',
          thinking: 'First ',
          tool_calls: [{ function: { name: 'unknown_one', arguments: {} } }],
        },
      }
      yield {
        message: {
          role: 'assistant',
          thinking: 'second',
          content: 'Working ',
          tool_calls: [{ function: { name: 'unknown_two', arguments: {} } }],
        },
      }
      yield { message: { role: 'assistant', content: 'now' } }
    })()
  })
  await import(example)
  await vi.waitFor(() => expect(requests).toHaveLength(2))
  expect(requests[1].map((message: any) => message.role)).toEqual([
    'user',
    'assistant',
    'tool',
    'tool',
  ])
  expect(requests[1][1]).toEqual({
    role: 'assistant',
    thinking: 'First second',
    content: 'Working now',
    tool_calls: [
      { function: { name: 'unknown_one', arguments: {} } },
      { function: { name: 'unknown_two', arguments: {} } },
    ],
  })
  expect(requests[1].slice(2).map((message: any) => message.tool_name)).toEqual([
    'unknown_one',
    'unknown_two',
  ])
})

it('starts the abort-all timer with the first stream and cancels streams arriving later', async () => {
  vi.useFakeTimers()
  let readyLast: (value: unknown) => void = () => {}
  const waiting: (() => void)[] = []
  let started = 0
  const stream = () => ({
    abort: vi.fn(),
    async *[Symbol.asyncIterator]() {
      started++
      await new Promise<void>((resolve) => waiting.push(resolve))
      throw new DOMException('Aborted', 'AbortError')
    },
  })
  mocks.abort.mockImplementation(() => waiting.splice(0).forEach((resolve) => resolve()))
  mocks.generate
    .mockResolvedValueOnce(stream())
    .mockResolvedValueOnce(stream())
    .mockReturnValueOnce(
      new Promise((resolve) => {
        readyLast = resolve
      }),
    )
  await import('../examples/abort/abort-all-requests')
  await vi.advanceTimersByTimeAsync(0)
  expect(started).toBe(2)
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(5000)
  expect(mocks.abort).toHaveBeenCalled()
  const lateStream = stream()
  readyLast(lateStream)
  await vi.advanceTimersByTimeAsync(0)
  expect(lateStream.abort).toHaveBeenCalledOnce()
  expect(started).toBe(2)
  expect(vi.getTimerCount()).toBe(0)
})
