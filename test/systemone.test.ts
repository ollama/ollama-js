import { describe, expect, it, vi } from 'vitest'
import nodeClient, { Ollama as NodeOllama } from '../src/index'
import browserClient, { Ollama as BrowserOllama } from '../src/browser'
import type { SystemOneRequest, SystemOneResponse } from '../src/index'
import type { SystemOneQuestion } from '../src/browser'

const refund: SystemOneQuestion = { type: 'noul', instructions: ['Refund?'] }
const request: SystemOneRequest = {
  model: 'nimble',
  state: { ticket: ['Duplicate charge', null], paid: true },
  questions: {
    team: { type: 'choice', instructions: { task: 'Route ticket' }, criteria: { technical: null, billing: 'Payments' } },
    refund,
    urgency: { type: 'score', instructions: 'Urgency?', criteria: ['Routine', 'Urgent'] },
  },
  keep_alive: 0,
}
const result: SystemOneResponse = {
  model: 'nimble',
  answers: {
    team: { type: 'choice', choice: 'billing', probabilities: { technical: 0.2, billing: 0.8 }, confidence: 0.3 },
    refund: { type: 'noul', noul: 0.9 },
    urgency: { type: 'score', score: 0.25, legend: { '0': 'Routine', '1': 'Urgent' }, probabilities: { '0': 0.75, '1': 0.25 }, confidence: 0.2 },
  },
  usage: { input_tokens: 123, output_tokens: 4 },
}

describe.each([['node', NodeOllama], ['browser', BrowserOllama]] as const)('%s systemone', (_, Client) => {
  it('preserves ordered structured input, null criteria, headers, and all answer variants', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
    const client = new Client({ host: 'http://sdk.test:11474', headers: { Authorization: 'Bearer synthetic' }, fetch })
    const response = await client.systemone(request)
    expect(response).toEqual(result)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('http://sdk.test:11474/v1/systemone')
    expect(options.method).toBe('POST')
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer synthetic')
    expect(JSON.parse(options.body)).toEqual(request)
    expect(Object.keys(JSON.parse(options.body).questions)).toEqual(['team', 'refund', 'urgency'])
    expect(Object.keys(JSON.parse(options.body).questions.team.criteria)).toEqual(['technical', 'billing'])
    expect(request).not.toHaveProperty('stream')
  })

  it.each([400, 404, 413, 503])('preserves HTTP %s errors', async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'synthetic server error' }), { status, headers: { 'Content-Type': 'application/json' } }))
    const client = new Client({ fetch })
    await expect(client.systemone(request)).rejects.toMatchObject({ status_code: status, message: 'synthetic server error' })
  })
})

it('supports the browser proxy and omits optional request fields', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
  const client = new BrowserOllama({ proxy: true, fetch })
  await client.systemone({ model: 'nimble', state: 'ticket', questions: { refund } })
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/v1/systemone')
  expect(JSON.parse(options.body)).toEqual({ model: 'nimble', state: 'ticket', questions: { refund } })
  expect(typeof nodeClient.systemone).toBe('function')
  expect(typeof browserClient.systemone).toBe('function')
})
