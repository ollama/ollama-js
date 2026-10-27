import { describe, expect, it, vi } from 'vitest'
import { Ollama as NodeOllama } from '../src/index'
import { Ollama as BrowserOllama } from '../src/browser'

for (const [name, Ollama] of [
  ['node', NodeOllama],
  ['browser', BrowserOllama],
] as const) {
  describe(`${name} client custom header values`, () => {
    it.each([
      [
        ['X-Context', 'first'],
        ['X-Context', 'second'],
      ],
      [
        ['X-Context', 'first'],
        ['x-context', 'second'],
        ['X-Context', 'third'],
      ],
      [
        ['Cookie', 'first=1'],
        ['Cookie', 'second=2'],
      ],
      [
        ['Set-Cookie', 'first=1'],
        ['Set-Cookie', 'second=2'],
      ],
    ])('preserves repeated tuple header values: %j', async (...headers) => {
      const expected = new Headers(headers)
      const fetch = vi.fn().mockResolvedValue(new Response('{"models":[]}'))
      const client = new Ollama({ host: 'http://localhost:11434', headers, fetch })

      await client.list()

      const actual = new Headers(fetch.mock.calls[0][1].headers)
      for (const [key] of headers) {
        expect(actual.get(key)).toBe(expected.get(key))
      }
    })

    it('preserves all values in a Headers instance', async () => {
      const headers = new Headers([
        ['Set-Cookie', 'first=1'],
        ['Set-Cookie', 'second=2'],
        ['X-Context', 'first'],
        ['X-Context', 'second'],
      ])
      const fetch = vi.fn().mockResolvedValue(new Response('{"models":[]}'))
      const client = new Ollama({ host: 'http://localhost:11434', headers, fetch })

      await client.list()

      const actual = new Headers(fetch.mock.calls[0][1].headers)
      expect(actual.get('set-cookie')).toBe(headers.get('set-cookie'))
      expect(actual.get('x-context')).toBe(headers.get('x-context'))
    })

    it('keeps reserved defaults and leaves the caller tuple list unchanged', async () => {
      const headers = [
        ['X-Context', 'first'],
        ['X-Context', 'second'],
        ['content-type', 'text/plain'],
        ['Content-Type', 'text/csv'],
        ['ACCEPT', 'text/plain'],
        ['user-agent', 'custom'],
      ]
      const original = JSON.stringify(headers)
      const fetch = vi.fn().mockResolvedValue(new Response('{"models":[]}'))
      const client = new Ollama({ host: 'http://localhost:11434', headers, fetch })

      await client.list()

      const actual = new Headers(fetch.mock.calls[0][1].headers)
      expect(actual.get('content-type')).toBe('application/json')
      expect(actual.get('accept')).toBe('application/json')
      expect(actual.get('user-agent')).toMatch(/^ollama-js\//)
      expect(JSON.stringify(headers)).toBe(original)
    })
  })
}

for (const [name, Ollama] of [
  ['node', NodeOllama],
  ['browser', BrowserOllama],
] as const) {
  describe(`${name} single authorization header compatibility`, () => {
    it.each([
      ['Authorization', '   '],
      ['AUTHORIZATION', 'caller-token'],
    ])('preserves %s while combining unrelated header values', async (key, value) => {
      vi.stubEnv('OLLAMA_API_KEY', 'synthetic-env-token')
      try {
        const headers = [
          [key, value],
          ['X-Context', 'first'],
          ['X-Context', 'second'],
        ]
        const fetch = vi.fn().mockResolvedValue(new Response('{"models":[]}'))
        const client = new Ollama({ host: 'https://ollama.com', headers, fetch })

        await client.list()

        const actual = fetch.mock.calls[0][1].headers
        expect(actual[key]).toBe(value)
        if (key === 'Authorization') {
          expect(new Headers(actual).get('authorization')).toBe('')
        }
        expect(new Headers(actual).get('x-context')).toBe('first, second')
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })
}
