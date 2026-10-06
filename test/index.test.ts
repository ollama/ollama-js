import { describe, expect, it } from 'vitest'
import { defaultHost } from '../src/constant'
import { formatHost } from '../src/utils'

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
    expect(formatHost('http://user:pass@localhost:5678')).toBe('http://user:pass@localhost:5678')
  })

  it('should preserve username with default port', () => {
    expect(formatHost('http://user@localhost')).toBe('http://user@localhost:80')
  })

  it('should preserve username and password with default port', () => {
    expect(formatHost('http://user:pass@localhost')).toBe('http://user:pass@localhost:80')
  })

  it('should preserve basic auth with https', () => {
    expect(formatHost('https://user:secret@secure.com')).toBe('https://user:secret@secure.com:443')
  })

  it('should preserve basic auth with domain and custom port', () => {
    expect(formatHost('http://admin:1234@example.com:8080')).toBe('http://admin:1234@example.com:8080')
  })

  it('should preserve basic auth and remove trailing slash', () => {
    expect(formatHost('http://john:doe@site.com:3000/')).toBe('http://john:doe@site.com:3000')
  })

  // Explicit port 80 (the default port for http, which `new URL` reports as an empty port)
  it('should preserve an explicit port 80 without a protocol', () => {
    expect(formatHost('myhost:80')).toBe('http://myhost:80')
  })

  it('should preserve an explicit port 80 on localhost without a protocol', () => {
    expect(formatHost('localhost:80')).toBe('http://localhost:80')
  })

  it('should preserve an explicit port 80 on an IPv6 host without a protocol', () => {
    expect(formatHost('[::1]:80')).toBe('http://[::1]:80')
  })

  it('should preserve an explicit port 80 with basic auth and no protocol', () => {
    expect(formatHost('user:pw@h:80')).toBe('http://user:pw@h:80')
  })

  it('should preserve an explicit port 80 with a trailing slash and no protocol', () => {
    expect(formatHost('myhost:80/')).toBe('http://myhost:80')
  })

  it('should still apply the default port when no port is given', () => {
    expect(formatHost('myhost')).toBe('http://myhost:11434')
    expect(formatHost('[::1]')).toBe('http://[::1]:11434')
    expect(formatHost('user:pw@h')).toBe('http://user:pw@h:11434')
  })

  it('should keep an explicit port 443 without a protocol', () => {
    expect(formatHost('myhost:443')).toBe('http://myhost:443')
  })

  it('should keep an explicit port 80 with an http protocol', () => {
    expect(formatHost('http://myhost:80')).toBe('http://myhost:80')
  })
})
