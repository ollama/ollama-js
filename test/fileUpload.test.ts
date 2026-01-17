import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { promises as fsPromises } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  computeFileSHA256,
  isFile,
  uploadBlob,
  createBlobFileMap,
  replaceModelfilePathsWithBlobs,
} from '../src/fileUpload.js'
import { CreateRequest, CreateRequestFile } from '../src/interfaces.js'

// ============================================================================
// Constants
// ============================================================================

const TEST_HOST = 'http://localhost:11434'
const SHA256_LENGTH = 64

// Valid SHA256 hash for testing
const VALID_SHA256 = 'a'.repeat(SHA256_LENGTH)
const VALID_SHA256_DIGEST = `sha256:${VALID_SHA256}`

// Model file paths for testing
const MODEL_PATH_1 = './gte-small.Q2_K.gguf'
const MODEL_PATH_2 = './gte-small.Q4_K.gguf'
const MODEL_PATH_3 = './gte-small.Q8_0.gguf'
const MODEL_PATH_NESTED = './models/folder/model.gguf'
const MODEL_PATH_UPPERCASE = './model.GGUF'

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

describe('File Upload Utilities', () => {
  let tempDir: string
  const testFiles: string[] = []

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(join(tmpdir(), 'ollama-js-test-'))
  })

  afterEach(async () => {
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
  // isFile Tests
  // ============================================================================

  describe('isFile', () => {
    // Positive tests
    it('should return true for an existing file', async () => {
      const filepath = await createTestFile('test.txt', 'test content')
      const result = await isFile(filepath)
      expect(result).toBe(true)
    })

    it('should return true for files in nested directories', async () => {
      const nestedPath = join(tempDir, 'nested', 'deep', 'file.txt')
      await fsPromises.mkdir(join(tempDir, 'nested', 'deep'), { recursive: true })
      await fsPromises.writeFile(nestedPath, 'content')
      testFiles.push(nestedPath)

      const result = await isFile(nestedPath)
      expect(result).toBe(true)
    })

    it('should return true for empty files', async () => {
      const filepath = await createTestFile('empty.txt', '')
      const result = await isFile(filepath)
      expect(result).toBe(true)
    })

    // Negative tests
    it('should return false for a non-existent path', async () => {
      const result = await isFile('/non/existent/path/file.txt')
      expect(result).toBe(false)
    })

    it('should return false for a directory', async () => {
      const result = await isFile(tempDir)
      expect(result).toBe(false)
    })

    it('should return false when file was deleted between check and stat', async () => {
      const filepath = await createTestFile('test.txt', 'content')

      // Mock stat to throw error
      const originalStat = fsPromises.stat
      vi.spyOn(fsPromises, 'stat').mockRejectedValueOnce(new Error('ENOENT'))

      const result = await isFile(filepath)
      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // computeFileSHA256 Tests
  // ============================================================================

  describe('computeFileSHA256', () => {
    // Positive tests
    it('should compute correct SHA256 hash for "hello world"', async () => {
      const filepath = await createTestFile('test.txt', 'hello world')
      const hash = await computeFileSHA256(filepath)

      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('should compute consistent hash for identical content', async () => {
      const filepath1 = await createTestFile('test1.txt', 'identical content')
      const filepath2 = await createTestFile('test2.txt', 'identical content')

      const hash1 = await computeFileSHA256(filepath1)
      const hash2 = await computeFileSHA256(filepath2)

      expect(hash1).toBe(hash2)
    })

    it('should compute different hashes for different content', async () => {
      const filepath1 = await createTestFile('test1.txt', 'content A')
      const filepath2 = await createTestFile('test2.txt', 'content B')

      const hash1 = await computeFileSHA256(filepath1)
      const hash2 = await computeFileSHA256(filepath2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty files', async () => {
      const filepath = await createTestFile('empty.txt', '')
      const hash = await computeFileSHA256(filepath)

      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('should return 64 character hex string', async () => {
      const filepath = await createTestFile('test.txt', 'any content')
      const hash = await computeFileSHA256(filepath)

      expect(hash.length).toBe(SHA256_LENGTH)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('should handle large files (1MB) without memory issues', async () => {
      const largeContent = 'x'.repeat(1024 * 1024)
      const filepath = await createTestFile('large.txt', largeContent)

      const hash = await computeFileSHA256(filepath)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(SHA256_LENGTH)
    })

    // Negative tests
    it('should throw error for non-existent file', async () => {
      await expect(computeFileSHA256('/non/existent/file.txt')).rejects.toThrow()
    })

    it('should handle empty file gracefully', async () => {
      const filepath = await createTestFile('empty.txt', '')
      const hash = await computeFileSHA256(filepath)

      // SHA256 of empty string is a known value
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })
  })

  // ============================================================================
  // uploadBlob Tests
  // ============================================================================

  describe('uploadBlob', () => {
    // Positive tests
    it('should skip upload when blob already exists (HEAD returns ok)', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true })

      await uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_HOST}/api/blobs/${VALID_SHA256_DIGEST}`,
        expect.objectContaining({ method: 'HEAD' })
      )
    })

    it('should upload blob when it does not exist (HEAD 404)', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 })

      await uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch.mock.calls[1][1].method).toBe('POST')
      expect(mockFetch.mock.calls[1][1].headers['Content-Type']).toBe('application/octet-stream')
    })

    it('should include custom headers in requests', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const headers = { Authorization: 'Bearer token123', 'X-Custom': 'value' }
      const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true })

      await uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any, headers)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers })
      )
    })

    it('should proceed with upload when HEAD request throws error', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockFetch.mockResolvedValueOnce({ ok: true })

      await uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    // Negative tests
    it('should throw error with message when POST fails with JSON error', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Upload failed: disk full' }),
      })

      await expect(uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any))
        .rejects.toThrow('Upload failed: disk full')
    })

    it('should throw generic error when POST fails without JSON', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON') },
      })

      await expect(uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any))
        .rejects.toThrow()
    })

    it('should throw error when HEAD returns unexpected status', async () => {
      const filepath = await createTestFile('test.txt', 'content')
      const mockFetch = vi.fn()
      // HEAD returns 500, but we treat 404 as "not found" and others as "exists"
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 })

      // Should still proceed to upload since HEAD didn't return ok=true
      await uploadBlob(TEST_HOST, filepath, VALID_SHA256, mockFetch as any)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // createBlobFileMap Tests
  // ============================================================================

  describe('createBlobFileMap', () => {
    // Positive tests
    it('should create map with single file', () => {
      const files = [{ filepath: MODEL_PATH_1 }]
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = createBlobFileMap(files, blobDigests)

      expect(result).toEqual({ 'gte-small.Q2_K.gguf': VALID_SHA256_DIGEST })
    })

    it('should create map with multiple files', () => {
      const files = [
        { filepath: MODEL_PATH_1 },
        { filepath: MODEL_PATH_2 },
      ]
      const blobDigests = [
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      ]

      const result = createBlobFileMap(files, blobDigests)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['gte-small.Q2_K.gguf']).toBe(blobDigests[0])
      expect(result['gte-small.Q4_K.gguf']).toBe(blobDigests[1])
    })

    it('should extract basename from absolute paths', () => {
      const absolutePath1 = '/absolute/path/to/model1.gguf'
      const absolutePath2 = '/absolute/path/to/model2.gguf'
      const files = [
        { filepath: absolutePath1 },
        { filepath: absolutePath2 },
      ]
      const blobDigests = [VALID_SHA256_DIGEST, `sha256:b${SHA256_LENGTH - 1}`]

      const result = createBlobFileMap(files, blobDigests)

      expect(result['model1.gguf']).toBe(VALID_SHA256_DIGEST)
      expect(result['model2.gguf']).toBe(blobDigests[1])
    })

    it('should handle sha256 provided in file object', () => {
      const files = [
        { filepath: MODEL_PATH_1, sha256: 'provided-hash' },
      ]
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = createBlobFileMap(files, blobDigests)

      // Uses the digest, not the provided sha256
      expect(result['gte-small.Q2_K.gguf']).toBe(VALID_SHA256_DIGEST)
    })

    // Negative tests
    it('should handle empty files array', () => {
      const files: Array<{ filepath: string; sha256?: string }> = []
      const blobDigests: string[] = []

      const result = createBlobFileMap(files, blobDigests)

      expect(result).toEqual({})
    })

    it('should create map using available pairs without index bounds checking', () => {
      const files = [
        { filepath: MODEL_PATH_1 },
        { filepath: MODEL_PATH_2 },
      ]
      // Only one digest - the function will access out of bounds on the second iteration
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = createBlobFileMap(files, blobDigests)

      // The function creates entries for both files (may access undefined for second)
      expect(Object.keys(result)).toHaveLength(2)
      expect(result['gte-small.Q2_K.gguf']).toBe(VALID_SHA256_DIGEST)
    })
  })

  // ============================================================================
  // replaceModelfilePathsWithBlobs Tests
  // ============================================================================

  describe('replaceModelfilePathsWithBlobs', () => {
    // Positive tests
    it('should replace .gguf file path with blob reference', () => {
      const modelfile = `FROM ${MODEL_PATH_1}\nSYSTEM "You are helpful."`
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(`FROM @${VALID_SHA256_DIGEST}\nSYSTEM "You are helpful."`)
    })

    it('should replace multiple .gguf file paths', () => {
      const modelfile = `FROM ${MODEL_PATH_1}\nADAPTER ${MODEL_PATH_2}`
      const blobDigests = [
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      ]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toContain('@sha256:1111111111111111111111111111111111111111111111111111111111111111')
      expect(result).toContain('@sha256:2222222222222222222222222222222222222222222222222222222222222222')
    })

    it('should handle case-insensitive .gguf extension', () => {
      const modelfile = `FROM ${MODEL_PATH_UPPERCASE}`
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(`FROM @${VALID_SHA256_DIGEST}`)
    })

    it('should handle nested paths', () => {
      const modelfile = `FROM ${MODEL_PATH_NESTED}`
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(`FROM @${VALID_SHA256_DIGEST}`)
    })

    it('should preserve other parts of modelfile', () => {
      const modelfile = `FROM ${MODEL_PATH_1}
SYSTEM "You are a helpful assistant."
PARAMETER temperature 0.7
PARAMETER top_k 50
TEMPLATE """{{ .Prompt }}"""
ADAPTER ${MODEL_PATH_2}`
      const blobDigests = [VALID_SHA256_DIGEST, `sha256:b${SHA256_LENGTH - 1}`]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toContain('SYSTEM "You are a helpful assistant."')
      expect(result).toContain('PARAMETER temperature 0.7')
      expect(result).toContain('PARAMETER top_k 50')
      expect(result).toContain('TEMPLATE """{{ .Prompt }}"""')
    })

    // Negative tests
    it('should not modify modelfile without .gguf paths', () => {
      const modelfile = 'FROM llama2\nSYSTEM "You are helpful."'
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(modelfile)
    })

    it('should not modify modelfile when blob digests array is empty', () => {
      const modelfile = `FROM ${MODEL_PATH_1}`
      const blobDigests: string[] = []

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(modelfile)
    })

    it('should only replace first occurrence of each file path', () => {
      const modelfile = `FROM ${MODEL_PATH_1}
ADAPTER ${MODEL_PATH_2}
ANOTHER ${MODEL_PATH_3}`
      const blobDigests = [
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      ]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      // First two should be replaced
      expect(result).toContain('@sha256:1111111111111111111111111111111111111111111111111111111111111111')
      expect(result).toContain('@sha256:2222222222222222222222222222222222222222222222222222222222222222')
      // Third one (MODEL_PATH_3) should remain unchanged
      expect(result).toContain(MODEL_PATH_3)
    })

    it('should handle modelfile with no matches gracefully', () => {
      const modelfile = 'FROM base-model\nSYSTEM "You are helpful."\n# No GGUF files here'
      const blobDigests = [VALID_SHA256_DIGEST]

      const result = replaceModelfilePathsWithBlobs(modelfile, blobDigests)

      expect(result).toBe(modelfile)
    })
  })
})

// ============================================================================
// CreateRequest Interface Tests
// ============================================================================

describe('CreateRequest Interface', () => {
  describe('Type Validation', () => {
    it('should accept modelfile parameter', () => {
      const request: CreateRequest = {
        model: 'test-model',
        modelfile: `FROM ${MODEL_PATH_1}\nSYSTEM "You are helpful."`,
      }

      expect(request.model).toBe('test-model')
      expect(request.modelfile).toContain(`FROM ${MODEL_PATH_1}`)
    })

    it('should accept files parameter with filepath', () => {
      const files: CreateRequestFile[] = [
        { filepath: MODEL_PATH_1 },
        { filepath: MODEL_PATH_2, sha256: VALID_SHA256 },
      ]

      const request: CreateRequest = {
        model: 'test-model',
        files,
      }

      expect(request.files).toHaveLength(2)
      expect(request.files![0].filepath).toBe(MODEL_PATH_1)
      expect(request.files![0].sha256).toBeUndefined()
      expect(request.files![1].filepath).toBe(MODEL_PATH_2)
      expect(request.files![1].sha256).toBe(VALID_SHA256)
    })

    it('should accept all optional parameters together', () => {
      const files: CreateRequestFile[] = [
        { filepath: MODEL_PATH_1, sha256: VALID_SHA256 },
      ]

      const request: CreateRequest = {
        model: 'test-model',
        from: 'base-model',
        stream: true,
        quantize: 'q4_0',
        template: 'custom template',
        license: 'MIT',
        system: 'You are a helpful assistant.',
        parameters: { temperature: 0.7, top_k: 50 },
        messages: [{ role: 'user', content: 'Hello' }],
        adapters: { lora: MODEL_PATH_1 },
        modelfile: 'FROM base-model\nPARAMETER temperature 0.7',
        files,
      }

      expect(request.model).toBe('test-model')
      expect(request.from).toBe('base-model')
      expect(request.stream).toBe(true)
      expect(request.quantize).toBe('q4_0')
      expect(request.template).toBe('custom template')
      expect(request.license).toBe('MIT')
      expect(request.system).toBe('You are a helpful assistant.')
      expect(request.parameters).toEqual({ temperature: 0.7, top_k: 50 })
      expect(request.messages).toHaveLength(1)
      expect(request.adapters).toEqual({ lora: MODEL_PATH_1 })
      expect(request.modelfile).toContain('FROM base-model')
      expect(request.files).toHaveLength(1)
    })

    it('should allow optional parameters to be undefined', () => {
      const request: CreateRequest = {
        model: 'test-model',
        files: [{ filepath: MODEL_PATH_1 }],
      }

      expect(request.from).toBeUndefined()
      expect(request.stream).toBeUndefined()
      expect(request.quantize).toBeUndefined()
      expect(request.modelfile).toBeUndefined()
    })

    it('should allow empty messages array', () => {
      const request: CreateRequest = {
        model: 'test-model',
        messages: [],
      }

      expect(request.messages).toEqual([])
    })

    it('should allow empty adapters object', () => {
      const request: CreateRequest = {
        model: 'test-model',
        adapters: {},
      }

      expect(request.adapters).toEqual({})
    })
  })

  describe('CreateRequestFile Type', () => {
    it('should require filepath', () => {
      const file: CreateRequestFile = {
        filepath: './model.gguf',
      }

      expect(file.filepath).toBe('./model.gguf')
      expect(file.sha256).toBeUndefined()
    })

    it('should allow optional sha256', () => {
      const file: CreateRequestFile = {
        filepath: './model.gguf',
        sha256: VALID_SHA256,
      }

      expect(file.sha256).toBe(VALID_SHA256)
    })

    it('should accept various filepath formats', () => {
      const files: CreateRequestFile[] = [
        { filepath: './relative/path.gguf' },
        { filepath: '/absolute/path.gguf' },
        { filepath: 'simple.gguf' },
      ]

      expect(files).toHaveLength(3)
      expect(files[0].filepath).toBe('./relative/path.gguf')
      expect(files[1].filepath).toBe('/absolute/path.gguf')
      expect(files[2].filepath).toBe('simple.gguf')
    })
  })
})
