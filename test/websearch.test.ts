import { describe, expect, it, vi } from 'vitest'
import { Ollama as NodeOllama } from '../src/index'
import { Ollama as BrowserOllama } from '../src/browser'
import type { WebSearchResponse } from '../src/index'

const result: WebSearchResponse = {
  results: [
    {
      title: 'Ollama',
      url: 'https://ollama.com/',
      content: 'Run and build applications with language models.',
    },
  ],
}

describe.each([
  ['node', NodeOllama],
  ['browser', BrowserOllama],
] as const)('%s webSearch', (_, Client) => {
  it('exposes the title and URL of each search result', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
    const client = new Client({
      fetch,
      headers: { Authorization: 'Bearer synthetic' },
    })
    const response = await client.webSearch({ query: 'What is Ollama?' })

    const citations: { title: string; url: string }[] = response.results.map(
      ({ title, url }) => ({ title, url }),
    )
    expect(citations).toEqual([{ title: 'Ollama', url: 'https://ollama.com/' }])
    expect(response.results[0].content).toBe(result.results[0].content)
  })
})
