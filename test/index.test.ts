import { Ollama } from '../src/index'
import { describe, it, expect } from 'vitest'
import { formatHost } from '../src/utils'

describe('formatHost Function Tests', () => {
  it('should return default URL for empty string', () => {
    expect(formatHost('')).toBe('http://127.0.0.1:11434')
  })

  it('should parse plain IP address', () => {
    expect(formatHost('1.2.3.4')).toBe('http://1.2.3.4:11434')
  })

  it('should parse IP address with port', () => {
    expect(formatHost('1.2.3.4:56789')).toBe('http://1.2.3.4:56789')
  })

  it('should parse with only a port', () => {
    expect(formatHost(':56789')).toBe('http://127.0.0.1:56789')
  })

  it('should parse HTTP URL', () => {
    expect(formatHost('http://1.2.3.4')).toBe('http://1.2.3.4:80')
  })

  it('should parse HTTPS URL', () => {
    expect(formatHost('https://1.2.3.4')).toBe('https://1.2.3.4:443')
  })

  it('should parse HTTPS URL with port', () => {
    expect(formatHost('https://1.2.3.4:56789')).toBe('https://1.2.3.4:56789')
  })

  it('should parse domain name', () => {
    expect(formatHost('example.com')).toBe('http://example.com:11434')
  })

  it('should parse domain name with port', () => {
    expect(formatHost('example.com:56789')).toBe('http://example.com:56789')
  })

  it('should parse HTTP domain', () => {
    expect(formatHost('http://example.com')).toBe('http://example.com:80')
  })

  it('should parse HTTPS domain', () => {
    expect(formatHost('https://example.com')).toBe('https://example.com:443')
  })

  it('should parse HTTPS domain with port', () => {
    expect(formatHost('https://example.com:56789')).toBe('https://example.com:56789')
  })

  it('should handle trailing slash in domain', () => {
    expect(formatHost('example.com/')).toBe('http://example.com:11434')
  })

  it('should handle trailing slash in domain with port', () => {
    expect(formatHost('example.com:56789/')).toBe('http://example.com:56789')
  })

  it('should handle trailing slash with only a port', () => {
    expect(formatHost(':56789/')).toBe('http://127.0.0.1:56789')
  })
})

describe('parseModelfile Function Tests', () => {
  it('should correctly parse modelfile commands', async () => {
    const ollama = new Ollama()
    const modelfile = `FROM llama2
ADAPTER ./path/to/adapter
TEMPLATE "You are a helpful assistant."
SYSTEM "Respond concisely"
MESSAGE assistant: Hello
MESSAGE user: Hi
LICENSE """Apache License
Version 2.0, January 2004"""
parameter1 value1
parameter2 value2
parameter3 3`

    const result = await ollama['parseModelfile']('mymodel', modelfile)

    expect(result).toEqual({
      model: 'mymodel',
      from: 'llama2',
      template: 'You are a helpful assistant.',
      system: 'Respond concisely',
      messages: [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Hi' }
      ],
      license: ['Apache License\n2.0, January 2004'],
      parameters: {
        parameter1: 'value1',
        parameter2: 'value2',
        parameter3: 3
      },
      files: {},
      adapters: {}
    })
  })
})
