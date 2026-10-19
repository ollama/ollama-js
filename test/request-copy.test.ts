import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Ollama as BrowserOllama } from '../src/browser'
import { Ollama as NodeOllama } from '../src/index'
import type {
  ChatRequest,
  Fetch,
  GenerateRequest,
  GenerateResponse,
  Message,
} from '../src/interfaces'

const BASE64 = 'AAH+/w=='
const bytes = () => new Uint8Array([0, 1, 254, 255])
const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

// One valid record for both endpoints: chat reads `message`, generate reads `response`.
const record = (done: boolean) => ({
  model: 'dummy',
  created_at: '2026-10-19T00:00:00Z',
  message: { role: 'assistant', content: 'ok' },
  response: 'ok',
  context: [],
  done,
  done_reason: done ? 'stop' : '',
  total_duration: 1,
  load_duration: 1,
  prompt_eval_count: 1,
  prompt_eval_duration: 1,
  eval_count: 1,
  eval_duration: 1,
})

function setup(Client: typeof BrowserOllama, fail = false) {
  const bodies: (GenerateRequest & ChatRequest)[] = []
  const fetch: Fetch = async (input, init) => {
    expect(String(input)).toMatch(
      /^http:\/\/offline\.invalid:11434\/api\/(chat|generate)$/,
    )
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    bodies.push(body)
    if (fail) {
      throw new TypeError('synthetic transport failure')
    }
    if (body.stream) {
      const ndjson = [record(false), record(true)].map((r) => JSON.stringify(r) + '\n')
      return new Response(ndjson.join(''), {
        headers: { 'Content-Type': 'application/x-ndjson' },
      })
    }
    return new Response(JSON.stringify(record(true)), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { client: new Client({ host: 'http://offline.invalid:11434', fetch }), bodies }
}

async function drain(stream: AsyncIterable<object>) {
  const done: boolean[] = []
  for await (const part of stream) {
    done.push((part as GenerateResponse).done)
  }
  return done
}

describe.each([
  { name: 'browser', Client: BrowserOllama },
  { name: 'node', Client: NodeOllama },
])('$name client copies chat/generate requests', ({ Client }) => {
  it('reuses a mutable generate request across non-streamed calls', async () => {
    const images = [bytes()]
    const image = images[0]
    const request: GenerateRequest & { stream?: false } = {
      model: 'dummy',
      prompt: 'p',
      images,
    }
    const { client, bodies } = setup(Client)

    await client.generate(request)
    await client.generate(request)

    const sent = { model: 'dummy', prompt: 'p', images: [BASE64], stream: false }
    expect(bodies).toEqual([sent, sent])
    expect(request.images).toBe(images)
    expect(images[0]).toBe(image)
    expect(own(request, 'stream')).toBe(false)
  })

  it('streams, then reuses, frozen chat history without writing to it', async () => {
    const images = [bytes()]
    const image = images[0]
    const withImage: Message = Object.freeze({ role: 'user', content: 'look', images })
    const plain: Message = Object.freeze({ role: 'assistant', content: 'ok' })
    const messages = [withImage, plain, withImage]
    const { client, bodies } = setup(Client)

    const stream = await client.chat(
      Object.freeze({ model: 'dummy', messages, stream: true as const }),
    )
    expect(await drain(stream)).toEqual([false, true])
    const reply = await client.chat(Object.freeze({ model: 'dummy', messages }))
    expect(reply.message.content).toBe('ok')

    const encoded = { role: 'user', content: 'look', images: [BASE64] }
    const sent = [encoded, { role: 'assistant', content: 'ok' }, encoded]
    expect(bodies).toEqual([
      { model: 'dummy', messages: sent, stream: true },
      { model: 'dummy', messages: sent, stream: false },
    ])
    expect(messages[0]).toBe(withImage)
    expect(messages[1]).toBe(plain)
    expect(withImage.images).toBe(images)
    expect(images[0]).toBe(image)
  })

  it('leaves caller input untouched when custom fetch rejects', async () => {
    const images = [bytes()]
    const image = images[0]
    const request = { model: 'dummy', prompt: 'p', images, stream: false as const }
    const message: Message = { role: 'user', content: 'look', images }
    const { client, bodies } = setup(Client, true)

    await expect(client.generate(request)).rejects.toThrow('synthetic transport failure')
    await expect(
      client.chat({ model: 'dummy', messages: [message], stream: true }),
    ).rejects.toThrow('synthetic transport failure')

    expect(bodies[0].images).toEqual([BASE64])
    expect(bodies[1].messages?.[0]?.images).toEqual([BASE64])
    expect(request.images).toBe(images)
    expect(message.images).toBe(images)
    expect(images[0]).toBe(image)
  })

  it('still sends writable inherited images and stream, as main does', async () => {
    const request: GenerateRequest & { stream: true } = Object.assign(
      Object.create({ images: [bytes()], stream: true }),
      { model: 'dummy', prompt: 'p' },
    )
    const message: Message = Object.assign(Object.create({ images: [bytes()] }), {
      role: 'user',
      content: 'look',
    })
    const { client, bodies } = setup(Client)

    expect(await drain(await client.generate(request))).toEqual([false, true])
    expect((await client.chat({ model: 'dummy', messages: [message] })).done).toBe(true)

    // Wire-level compatibility control only: main promotes these to own fields,
    // so caller state is deliberately not asserted here.
    expect(bodies).toEqual([
      { model: 'dummy', prompt: 'p', images: [BASE64], stream: true },
      {
        model: 'dummy',
        messages: [{ role: 'user', content: 'look', images: [BASE64] }],
        stream: false,
      },
    ])
  })
})

describe('node client file path images', () => {
  let dir: string
  let path: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ollama-js-'))
    path = join(dir, 'image.bin')
    writeFileSync(path, bytes())
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('sends file contents while frozen caller requests keep the path', async () => {
    const images = [path]
    const message: Message = Object.freeze({ role: 'user', content: 'look', images })
    const request = Object.freeze({
      model: 'dummy',
      prompt: 'p',
      images,
      stream: true as const,
    })
    const { client, bodies } = setup(NodeOllama)

    expect(await drain(await client.generate(request))).toEqual([false, true])
    await client.chat({ model: 'dummy', messages: [message], stream: false })

    expect(bodies[0].images).toEqual([BASE64])
    expect(bodies[1].messages?.[0]?.images).toEqual([BASE64])
    expect(images).toEqual([path])
    expect(request.images).toBe(images)
    expect(message.images).toBe(images)
  })
})
