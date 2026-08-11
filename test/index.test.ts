import { describe, expect, it, vi } from 'vitest'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultHost } from '../src/constant'
import { formatHost } from '../src/utils'
import { Ollama } from '../src'

describe('formatHost Function Tests', () => {
  it('should return default URL for empty string', () => {
    expect(formatHost('')).toBe(defaultHost)
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

  // Basic Auth Tests
  it('should preserve username in URL', () => {
    expect(formatHost('http://user@localhost:1234')).toBe('http://user@localhost:1234')
  })

  it('should preserve username and password in URL', () => {
    expect(formatHost('http://user:pass@localhost:5678')).toBe(
      'http://user:pass@localhost:5678',
    )
  })

  it('should preserve username with default port', () => {
    expect(formatHost('http://user@localhost')).toBe('http://user@localhost:80')
  })

  it('should preserve username and password with default port', () => {
    expect(formatHost('http://user:pass@localhost')).toBe('http://user:pass@localhost:80')
  })

  it('should preserve basic auth with https', () => {
    expect(formatHost('https://user:secret@secure.com')).toBe(
      'https://user:secret@secure.com:443',
    )
  })

  it('should preserve basic auth with domain and custom port', () => {
    expect(formatHost('http://admin:1234@example.com:8080')).toBe(
      'http://admin:1234@example.com:8080',
    )
  })

  it('should preserve basic auth and remove trailing slash', () => {
    expect(formatHost('http://john:doe@site.com:3000/')).toBe(
      'http://john:doe@site.com:3000',
    )
  })
})

describe('Ollama encodeImage', () => {
  const ollama = new Ollama()

  it('converts a Uint8Array to base64', async () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const result = await ollama.encodeImage(input)
    expect(result).toBe(Buffer.from(input).toString('base64'))
    expect(result).toBe('SGVsbG8=')
  })

  it('converts a Buffer to base64', async () => {
    const input = Buffer.from('World')
    const result = await ollama.encodeImage(input)
    expect(result).toBe('V29ybGQ=')
  })

  it('reads a file and base64-encodes it', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ollama-test-'))
    const filePath = join(tmpDir, 'test.bin')
    writeFileSync(filePath, 'file contents')

    try {
      const result = await ollama.encodeImage(filePath)
      expect(result).toBe(Buffer.from('file contents').toString('base64'))
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('returns the string as-is when the path does not exist', async () => {
    const result = await ollama.encodeImage('/nonexistent/path/to/file.bin')
    expect(result).toBe('/nonexistent/path/to/file.bin')
  })

  it('passes through a plain string', async () => {
    const result = await ollama.encodeImage('SGVsbG8=')
    expect(result).toBe('SGVsbG8=')
  })
})

describe('Ollama create', () => {
  it('throws when from points to a local file', async () => {
    const ollama = new Ollama()
    const tmpDir = mkdtempSync(join(tmpdir(), 'ollama-test-'))
    const filePath = join(tmpDir, 'model.gguf')
    writeFileSync(filePath, 'fake model data')

    try {
      await expect(
        ollama.create({
          from: filePath,
          name: 'test-model',
        } as any),
      ).rejects.toThrow('Creating with a local path is not currently supported')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('delegates to super.create with stream: true', async () => {
    const ollama = new Ollama()
    const spy = vi
      .spyOn(ollama as any, 'processStreamableRequest')
      .mockResolvedValue({} as any)

    await ollama.create({
      name: 'test-model',
      from: 'llama3',
      stream: true,
    } as any)

    expect(spy).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ name: 'test-model', from: 'llama3', stream: true }),
    )
    spy.mockRestore()
  })

  it('delegates to super.create without stream', async () => {
    const ollama = new Ollama()
    const spy = vi
      .spyOn(ollama as any, 'processStreamableRequest')
      .mockResolvedValue({} as any)

    await ollama.create({
      name: 'test-model',
      from: 'llama3',
    } as any)

    expect(spy).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ name: 'test-model', from: 'llama3' }),
    )
    spy.mockRestore()
  })
})
