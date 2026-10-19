import { describe, expect, it, vi, beforeEach, afterEach, Mock, beforeAll, afterAll } from 'vitest'
import { promises as fsPromises } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Ollama } from '../src/index.js'
import { computeFileSHA256 } from '../src/fileUpload.js'

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

const TEST_HOST = 'http://localhost:11434'

interface MockFetchSetup {
  blobHeadResponse?: { ok: boolean; status?: number }
  blobPostResponse?: { ok: boolean; status?: number; statusText?: string }
  createResponse?: { ok: boolean; status?: number; body?: ReadableStream; jsonData?: object }
}

function createMockFetch(setup: MockFetchSetup): Mock {
  const mockFetch = vi.fn()

  // Blob HEAD check (if blob doesn't exist)
  if (setup.blobHeadResponse !== undefined) {
    mockFetch.mockResolvedValueOnce(setup.blobHeadResponse)
  }

  // Blob POST upload (if blob needs to be uploaded)
  if (setup.blobPostResponse !== undefined) {
    mockFetch.mockResolvedValueOnce({
      ok: setup.blobPostResponse.ok,
      status: setup.blobPostResponse.status ?? 200,
      statusText: setup.blobPostResponse.statusText ?? 'OK',
    })
  }

  // Create request response
  if (setup.createResponse !== undefined) {
    const { ok, status, body, jsonData } = setup.createResponse

    // For streaming responses, create a mock stream
    if (body !== undefined) {
      mockFetch.mockResolvedValueOnce({
        ok: ok ?? true,
        status: status ?? 200,
        body,
      })
    } else {
      mockFetch.mockResolvedValueOnce({
        ok: ok ?? true,
        status: status ?? 200,
        json: async () => jsonData ?? { status: 'success' },
        body: null,
      })
    }
  }

  return mockFetch
}

function createMockStream(responses: object[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const response of responses) {
        controller.enqueue(encoder.encode(JSON.stringify(response) + '\n'))
      }
      controller.close()
    },
  })
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Ollama.create File Upload HTTP Integration', () => {
  let tempDir: string
  const testFiles: string[] = []
  let ollama: Ollama

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(join(tmpdir(), 'ollama-js-test-'))
    ollama = new Ollama({ host: TEST_HOST })
  })

  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 5))
    vi.restoreAllMocks()

    for (const file of testFiles) {
      try {
        await fsPromises.unlink(file)
      } catch { /* ignore */ }
    }
    try {
      await fsPromises.rmdir(tempDir)
    } catch { /* ignore */ }
  })

  const createTestFile = async (filename: string, content: string): Promise<string> => {
    const filepath = join(tempDir, filename)
    await fsPromises.writeFile(filepath, content)
    testFiles.push(filepath)
    return filepath
  }

  // ============================================================================
  // Positive Tests: Request Structure
  // ============================================================================

  describe('Request Structure', () => {
    it('should make correct HTTP requests for file upload (HEAD, POST, CREATE)', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')
      const sha256 = await computeFileSHA256(filepath)

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)

      // Verify HEAD request
      expect(mockFetch.mock.calls[0][0]).toContain(`/api/blobs/sha256:${sha256}`)
      expect(mockFetch.mock.calls[0][1].method).toBe('HEAD')

      // Verify POST request
      expect(mockFetch.mock.calls[1][0]).toContain(`/api/blobs/sha256:${sha256}`)
      expect(mockFetch.mock.calls[1][1].method).toBe('POST')
      expect(mockFetch.mock.calls[1][1].headers['Content-Type']).toBe('application/octet-stream')

      // Verify CREATE request
      expect(mockFetch.mock.calls[2][0]).toBe(`${TEST_HOST}/api/create`)
      expect(mockFetch.mock.calls[2][1].method).toBe('POST')
      expect(mockFetch.mock.calls[2][1].headers['Content-Type']).toBe('application/json')
    })

    it('should include model name in create request body', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await ollama.create({
        model: 'my-custom-model',
        files: [{ filepath }],
      })

      const [, options] = mockFetch.mock.calls[2]
      const body = JSON.parse(options.body)

      expect(body.name).toBe('my-custom-model')
    })

    it('should include files mapping in create request body', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')
      const sha256 = await computeFileSHA256(filepath)

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
      })

      const [, options] = mockFetch.mock.calls[2]
      const body = JSON.parse(options.body)

      expect(body.files).toBeDefined()
      expect(body.files['model.gguf']).toBe(`sha256:${sha256}`)
    })

    it('should include modelfile with blob references in create request', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')
      const sha256 = await computeFileSHA256(filepath)

      const modelfile = 'FROM ./model.gguf\nSYSTEM "You are a helpful assistant."'

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
        modelfile,
      })

      const [, options] = mockFetch.mock.calls[2]
      const body = JSON.parse(options.body)

      expect(body.modelfile).toBeDefined()
      expect(body.modelfile).toContain(`@sha256:${sha256}`)
      expect(body.modelfile).not.toContain('./model.gguf')
    })

    it('should include quantize parameter when provided', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
        quantize: 'Q4_K_M',
      })

      const [, options] = mockFetch.mock.calls[2]
      const body = JSON.parse(options.body)

      expect(body.quantize).toBe('Q4_K_M')
    })

    it('should handle multiple files with separate uploads', async () => {
      const mockFetch = createMockFetch({})
      // File 1: HEAD + POST
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 })
      // File 2: HEAD + POST
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 })
      // Create request
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'success' }), body: null })

      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath1 = await createTestFile('model1.gguf', 'content 1')
      const filepath2 = await createTestFile('model2.gguf', 'content 2')

      await ollama.create({
        model: 'test-model',
        files: [{ filepath: filepath1 }, { filepath: filepath2 }],
      })

      // Should have 5 calls: HEAD+POST for file1 + HEAD+POST for file2 + create
      expect(mockFetch).toHaveBeenCalledTimes(5)

      const [, options] = mockFetch.mock.calls[4]
      const body = JSON.parse(options.body)

      expect(Object.keys(body.files)).toHaveLength(2)
    })
  })

  // ============================================================================
  // Positive Tests: Streaming & Flow
  // ============================================================================

  describe('Streaming & Response Flow', () => {
    it('should return async iterator for streaming responses', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: {
          ok: true,
          status: 200,
          body: createMockStream([{ status: 'pulling manifest' }, { status: 'success' }]),
        },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      const response = await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
        stream: true,
      })

      expect(response).toBeDefined()
      expect(typeof response[Symbol.asyncIterator]).toBe('function')
    })

    it('should return plain object for non-streaming responses', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: {
          ok: true,
          status: 200,
          jsonData: { status: 'success' },
        },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      const response = await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
        stream: false,
      })

      // Response should be a plain object with status property
      expect(response).toHaveProperty('status')
      expect((response as any).status).toBe('success')
      // Should not be an async iterator (check that Symbol.asyncIterator is undefined)
      expect((response as any)[Symbol.asyncIterator]).toBeUndefined()
    })

    it('should skip blob upload when blob already exists (HEAD returns ok)', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: true, status: 200 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
      })

      // Should only have 2 calls: HEAD + CREATE (no POST)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // Positive Tests: SHA256 Handling
  // ============================================================================

  describe('SHA256 Handling', () => {
    it('should compute SHA256 when not provided', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }], // No sha256 provided
      })

      const [blobUrl] = mockFetch.mock.calls[1]
      expect(blobUrl).toMatch(/sha256:[a-f0-9]{64}/)
    })

    it('should use user-provided SHA256', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')
      const userProvidedSHA256 = 'a'.repeat(64)

      await ollama.create({
        model: 'test-model',
        files: [{ filepath, sha256: userProvidedSHA256 }],
      })

      const [blobUrl] = mockFetch.mock.calls[1]
      expect(blobUrl).toContain(`/api/blobs/sha256:${userProvidedSHA256}`)
    })
  })

  // ============================================================================
  // Negative Tests: Validation Errors
  // ============================================================================

  describe('Validation Errors', () => {
    it('should throw error when files array is empty', async () => {
      // Provide a mock fetch that returns a valid response (should not be called)
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      await expect(
        ollama.create({
          model: 'test-model',
          files: [],
        }),
      ).rejects.toThrow('At least one file must be specified when using file upload')

      // Verify fetch was never called (validation should prevent any HTTP requests)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw error when file does not exist', async () => {
      // Provide a mock fetch that returns a valid response (should not be called)
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      await expect(
        ollama.create({
          model: 'test-model',
          files: [{ filepath: '/non/existent/path/model.gguf' }],
        }),
      ).rejects.toThrow('File not found')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw error when using local path in "from" field', async () => {
      const filepath = await createTestFile('model.gguf', 'content')
      ollama = new Ollama({ host: TEST_HOST })

      await expect(
        ollama.create({
          model: 'test-model',
          from: filepath,
        }),
      ).rejects.toThrow('Creating with a local path is not currently supported')
    })
  })

  // ============================================================================
  // Negative Tests: HTTP Errors
  // ============================================================================

  describe('HTTP Errors', () => {
    it('should throw error when blob POST upload fails with error message', async () => {
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }) // HEAD
      mockFetch.mockResolvedValueOnce({
        // POST fails
        ok: false,
        status: 500,
        json: async () => ({ error: 'Storage full' }),
      })

      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })
      const filepath = await createTestFile('model.gguf', 'content')

      await expect(
        ollama.create({
          model: 'test-model',
          files: [{ filepath }],
        }),
      ).rejects.toThrow('Storage full')
    })

    it('should throw error when create request fails with error message', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: {
          ok: false,
          status: 400,
          jsonData: { error: 'invalid modelfile format' },
        },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await expect(
        ollama.create({
          model: 'test-model',
          files: [{ filepath }],
        }),
      ).rejects.toThrow('invalid modelfile format')
    })

    it('should throw error when create request fails without JSON error', async () => {
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }) // HEAD
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 }) // POST
      mockFetch.mockResolvedValueOnce({
        // CREATE fails without JSON
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON') },
      })

      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })
      const filepath = await createTestFile('model.gguf', 'content')

      await expect(
        ollama.create({
          model: 'test-model',
          files: [{ filepath }],
        }),
      ).rejects.toThrow()
    })

    it('should throw error when HEAD request throws network error and POST also fails', async () => {
      const mockFetch = vi.fn()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      })

      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })
      const filepath = await createTestFile('model.gguf', 'content')

      await expect(
        ollama.create({
          model: 'test-model',
          files: [{ filepath }],
        }),
      ).rejects.toThrow('Service unavailable')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle all optional parameters together', async () => {
      const mockFetch = createMockFetch({
        blobHeadResponse: { ok: false, status: 404 },
        blobPostResponse: { ok: true, status: 201 },
        createResponse: { ok: true, status: 200 },
      })
      ollama = new Ollama({ host: TEST_HOST, fetch: mockFetch })

      const filepath = await createTestFile('model.gguf', 'content')

      await ollama.create({
        model: 'test-model',
        files: [{ filepath }],
        stream: false,
        quantize: 'q4_0',
        template: 'custom template',
        license: 'MIT',
        system: 'You are helpful.',
        parameters: { temperature: 0.7 },
        messages: [{ role: 'user', content: 'Hello' }],
        adapters: { lora: './adapter.gguf' },
      })

      const [, options] = mockFetch.mock.calls[2]
      const body = JSON.parse(options.body)

      expect(body.name).toBe('test-model')
      expect(body.quantize).toBe('q4_0')
      expect(body.template).toBe('custom template')
      expect(body.license).toBe('MIT')
      expect(body.system).toBe('You are helpful.')
      expect(body.parameters).toEqual({ temperature: 0.7 })
      expect(body.messages).toHaveLength(1)
      expect(body.adapters).toEqual({ lora: './adapter.gguf' })
    })
  })
})
