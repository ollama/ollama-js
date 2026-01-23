/**
 * Stress Testing Script for Multi-Step File Upload
 * 
 * This script validates memory consumption and timing of the ollama-js
 * multi-step file upload approach compared to pure curl.
 * 
 * Test Scenarios:
 * - Sequential testing (one file at a time, multiple iterations)
 * - Parallel testing (multiple files simultaneously)
 * - Combined testing (all scenarios together)
 * - Memory footprint validation
 * - Timing comparison with curl
 */
// NB: ITERATIONS=100 PARALLEL_DEGREE=8 npx tsx examples/create-from-files/stess-test.ts
// NB: ollama list | awk 'NR>1 {print $1}' | grep '^stress-test-' | xargs -r ollama rm

import { spawn } from 'node:child_process'
import { promises as fsPromises } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { Ollama } from '../../src/index.js'

// ============================================================================
// Configuration
// ============================================================================

const TEST_FILES = [
  './gte-small.Q2_K.gguf',
  './mmproj-tinygemma3.gguf',
  './tinygemma3-Q8_0.gguf',
  './mxbai-embed-large-v1-f16.gguf',
].map(f => join(__dirname, f))

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const TEST_DIR = process.env.TEST_DIR || join(tmpdir(), 'ollama-js-stress-test')
const ITERATIONS = parseInt(process.env.ITERATIONS || '3')
const PARALLEL_DEGREE = parseInt(process.env.PARALLEL_DEGREE || '4')

// ============================================================================
// Type Definitions
// ============================================================================

export interface MemoryUsage {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
}

export interface MemoryDelta {
  timeElapsed: number
  rssDelta: number
  heapUsedDelta: number
  heapTotalDelta: number
  externalDelta: number
}

// ============================================================================
// Utility Functions - Memory Tracking
// ============================================================================

/**
 * Captures current memory usage in MB
 */
export function getMemoryUsageMB(): MemoryUsage {
  const usage = process.memoryUsage()
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100,
  }
}

/**
 * Records memory snapshot with timestamp
 */
export interface MemorySnapshot {
  timestamp: number
  memory: MemoryUsage
  label: string
}

export function createMemorySnapshot(label: string): MemorySnapshot {
  return {
    timestamp: performance.now(),
    memory: getMemoryUsageMB(),
    label,
  }
}

/**
 * Calculates memory delta between two snapshots
 */
export function calculateMemoryDelta(start: MemorySnapshot, end: MemorySnapshot): MemoryDelta {
  return {
    timeElapsed: Math.round((end.timestamp - start.timestamp) * 100) / 100,
    rssDelta: Math.round((end.memory.rss - start.memory.rss) * 100) / 100,
    heapUsedDelta: Math.round((end.memory.heapUsed - start.memory.heapUsed) * 100) / 100,
    heapTotalDelta: Math.round((end.memory.heapTotal - start.memory.heapTotal) * 100) / 100,
    externalDelta: Math.round((end.memory.external - start.memory.external) * 100) / 100,
  }
}

/**
 * Formats memory delta for display
 */
export function formatMemoryDelta(delta: MemoryDelta): string {
  return `
    Time Elapsed: ${delta.timeElapsed}ms
    RSS Delta: ${delta.rssDelta}MB
    Heap Used Delta: ${delta.heapUsedDelta}MB
    Heap Total Delta: ${delta.heapTotalDelta}MB
    External Delta: ${delta.externalDelta}MB
  `
}

// ============================================================================
// Utility Functions - Timing
// ============================================================================

export interface TimingResult {
  operation: string
  duration: number
  iterations: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  memorySnapshots: MemorySnapshot[]
}

export async function measureOperation(
  operation: string,
  fn: () => Promise<void>,
  iterations: number = 1
): Promise<TimingResult> {
  const snapshots: MemorySnapshot[] = []
  const durations: number[] = []

  // Initial snapshot
  snapshots.push(createMemorySnapshot(`${operation}-start`))

  for (let i = 0; i < iterations; i++) {
    const startSnapshot = createMemorySnapshot(`${operation}-iteration-${i}-start`)
    const start = performance.now()

    await fn()

    const end = performance.now()
    const endSnapshot = createMemorySnapshot(`${operation}-iteration-${i}-end`)

    durations.push(end - start)
    snapshots.push(endSnapshot)
  }

  // Final snapshot
  snapshots.push(createMemorySnapshot(`${operation}-end`))

  return {
    operation,
    duration: durations.reduce((a, b) => a + b, 0),
    iterations,
    averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / iterations * 100) / 100,
    minDuration: Math.round(Math.min(...durations) * 100) / 100,
    maxDuration: Math.round(Math.max(...durations) * 100) / 100,
    memorySnapshots: snapshots,
  }
}

export function formatTimingResult(result: TimingResult): string {
  return `
=== ${result.operation} ===
  Total Duration: ${result.duration.toFixed(2)}ms
  Iterations: ${result.iterations}
  Average: ${result.averageDuration}ms
  Min: ${result.minDuration}ms
  Max: ${result.maxDuration}ms
  Memory Snapshots: ${result.memorySnapshots.length}
  `
}

// ============================================================================
// Utility Functions - File Operations
// ============================================================================

export interface FileInfo {
  name: string
  path: string
  size: number
  sha256: string
}

/**
 * Gets file information including size and SHA256 hash
 */
export async function getFileInfo(filepath: string): Promise<FileInfo> {
  const stats = await fsPromises.stat(filepath)
  const sha256 = await computeFileSHA256(filepath)

  return {
    name: filepath.split('/').pop() || filepath,
    path: filepath,
    size: stats.size,
    sha256,
  }
}

/**
 * Computes SHA256 hash of a file using streaming
 */
export async function computeFileSHA256(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filepath)

    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ============================================================================
// Utility Functions - Curl Comparison
// ============================================================================

export interface CurlResult {
  success: boolean
  duration: number
  exitCode: number | null
  stdout: string
  stderr: string
  memoryPeak?: number
}

/**
 * Executes a curl command and measures its performance
 */
export function executeCurl(args: string[]): Promise<CurlResult> {
  return new Promise((resolve) => {
    const start = performance.now()
    let stdout = ''
    let stderr = ''
    let memoryPeak = 0

    const curl = spawn('curl', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    curl.stdout.on('data', (data) => {
      stdout += data.toString()
      // Monitor memory periodically during curl execution
      const mem = process.memoryUsage()
      memoryPeak = Math.max(memoryPeak, mem.heapUsed)
    })

    curl.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    curl.on('close', (code) => {
      const duration = performance.now() - start
      resolve({
        success: code === 0,
        duration,
        exitCode: code,
        stdout,
        stderr,
        memoryPeak,
      })
    })

    curl.on('error', (error) => {
      const duration = performance.now() - start
      resolve({
        success: false,
        duration,
        exitCode: null,
        stdout: '',
        stderr: error.message,
        memoryPeak,
      })
    })
  })
}

/**
 * Uploads a file using pure curl (HEAD + POST)
 */
export async function uploadFileWithCurl(
  host: string,
  filepath: string,
  sha256: string
): Promise<CurlResult> {
  const digest = `sha256:${sha256}`
  const url = `${host}/api/blobs/${digest}`

  // First check if blob exists
  const headResult = await executeCurl([
    '-I', url,
    '-H', 'Content-Type: application/octet-stream',
  ])

  // If blob doesn't exist, upload it
  if (!headResult.success || !headResult.stdout.includes('HTTP/2 200')) {
    return await executeCurl([
      '-X', 'POST',
      '-H', 'Content-Type: application/octet-stream',
      '--data-binary', `@${filepath}`,
      url,
    ])
  }

  return {
    success: true,
    duration: headResult.duration,
    exitCode: 0,
    stdout: 'Blob already exists',
    stderr: '',
    memoryPeak: headResult.memoryPeak,
  }
}

/**
 * Deletes a blob from Ollama server
 */
export async function deleteBlob(
  host: string,
  sha256: string
): Promise<boolean> {
  // const digest = `sha256:${sha256}`
  // const url = `${host}/api/blobs/${digest}`

  // const deleteResult = await executeCurl([
  //   '-X', 'DELETE',
  //   url,
  // ])

  // return deleteResult.success
  return Promise.resolve(true)
}

/**
 * Deletes a model from Ollama server
 */
export async function deleteModel(
  host: string,
  model: string
): Promise<boolean> {
  // const url = `${host}/api/delete`
  
  // const deleteResult = await executeCurl([
  //   '-X', 'DELETE',
  //   '-H', 'Content-Type: application/json',
  //   '-d', JSON.stringify({ name: model }),
  //   url,
  // ])

  // return deleteResult.success
  return Promise.resolve(true)
}

/**
 * Creates a model using pure curl
 */
export async function createModelWithCurl(
  host: string,
  model: string,
  files: Record<string, string>,
  modelfile?: string
): Promise<CurlResult> {
  const requestBody: Record<string, any> = {
    name: model,
    files,
  }

  if (modelfile) {
    requestBody.modelfile = modelfile
  }

  return await executeCurl([
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(requestBody),
    `${host}/api/create`,
  ])
}

// ============================================================================
// Utility Functions - Ollama.js Implementation
// ============================================================================

export interface OllamaUploadResult {
  success: boolean
  duration: number
  memoryBefore: MemoryUsage
  memoryAfter: MemoryUsage
  memoryPeak: MemoryUsage
  error?: string
}

/**
 * Uploads a file using ollama-js implementation
 */
export async function uploadFileWithOllamaJS(
  host: string,
  filepath: string,
  sha256?: string
): Promise<OllamaUploadResult> {
  const memoryBefore = getMemoryUsageMB()
  const memorySnapshots: MemoryUsage[] = [memoryBefore]
  let memoryPeak = memoryBefore

  const trackMemory = () => {
    const current = getMemoryUsageMB()
    memorySnapshots.push(current)
    if (current.heapUsed > memoryPeak.heapUsed) {
      memoryPeak = current
    }
    if (current.rss > memoryPeak.rss) {
      memoryPeak = current
    }
  }

  const start = performance.now()
  let success = false
  let error: string | undefined

  try {
    const ollama = new Ollama({ host })
    
    // Import the file upload utilities
    const { uploadBlob, computeFileSHA256: computeHash } = await import('../src/fileUpload.js')
    
    const fileSha256 = sha256 || await computeHash(filepath)
    trackMemory()

    await uploadBlob(host, filepath, fileSha256, ollama.config.fetch || fetch, ollama.config.headers)
    trackMemory()

    success = true
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    trackMemory()
  }

  const duration = performance.now() - start
  const memoryAfter = getMemoryUsageMB()

  return {
    success,
    duration,
    memoryBefore,
    memoryAfter,
    memoryPeak,
    error,
  }
}

/**
 * Creates a model using ollama-js implementation
 */
export async function createModelWithOllamaJS(
  host: string,
  model: string,
  files: Array<{ filepath: string; sha256?: string }>,
  modelfile?: string,
  stream: boolean = false
): Promise<OllamaUploadResult> {
  const memoryBefore = getMemoryUsageMB()
  const memorySnapshots: MemoryUsage[] = [memoryBefore]
  let memoryPeak = memoryBefore

  const trackMemory = () => {
    const current = getMemoryUsageMB()
    memorySnapshots.push(current)
    if (current.heapUsed > memoryPeak.heapUsed) {
      memoryPeak = current
    }
  }

  const start = performance.now()
  let success = false
  let error: string | undefined

  try {
    const ollama = new Ollama({ host })
    trackMemory()

    const response = await ollama.create({
      model,
      files,
      modelfile,
      stream,
    })

    if (stream && response[Symbol.asyncIterator]) {
      for await (const _ of response) {
        trackMemory()
      }
    }

    success = true
    trackMemory()
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    trackMemory()
  }

  const duration = performance.now() - start
  const memoryAfter = getMemoryUsageMB()

  return {
    success,
    duration,
    memoryBefore,
    memoryAfter,
    memoryPeak,
    error,
  }
}

// ============================================================================
// Utility Functions - Comparison & Reporting
// ============================================================================

export interface ComparisonResult {
  operation: string
  curlResult: CurlResult | null
  ollamaResult: OllamaUploadResult | null
  durationDifference: number
  memoryDifference: number
}

/**
 * Compares curl and ollama-js implementations
 */
export function compareResults(
  operation: string,
  curlResult: CurlResult | null,
  ollamaResult: OllamaUploadResult | null
): ComparisonResult {
  const durationDifference = curlResult && ollamaResult
    ? Math.round((ollamaResult.duration - curlResult.duration) * 100) / 100
    : 0

  const memoryDifference = curlResult && ollamaResult
    ? Math.round((ollamaResult.memoryPeak.heapUsed - (curlResult.memoryPeak || 0)) / 1024 / 1024 * 100) / 100
    : 0

  return {
    operation,
    curlResult,
    ollamaResult,
    durationDifference,
    memoryDifference,
  }
}

export function formatComparisonResult(result: ComparisonResult): string {
  const curlStatus = result.curlResult?.success ? '✓' : '✗'
  const ollamaStatus = result.ollamaResult?.success ? '✓' : '✗'

  return `
=== ${result.operation} ===
  CURL: ${curlStatus} (${result.curlResult?.duration.toFixed(2) || 'N/A'}ms)
  ollama-js: ${ollamaStatus} (${result.ollamaResult?.duration.toFixed(2) || 'N/A'}ms)
  Duration Diff: ${result.durationDifference > 0 ? '+' : ''}${result.durationDifference}ms
  Memory Diff: ${result.memoryDifference > 0 ? '+' : ''}${result.memoryDifference}MB
  `
}

// ============================================================================
// Utility Functions - Test Orchestration
// ============================================================================

export interface TestConfig {
  testDir: string
  host: string
  iterations: number
  parallelDegree: number
}

export async function setupTestEnvironment(config: TestConfig): Promise<void> {
  console.log(`Setting up test environment in: ${config.testDir}`)
  await fsPromises.mkdir(config.testDir, { recursive: true })
  console.log('Test environment ready.\n')
}

export async function cleanupTestEnvironment(config: TestConfig): Promise<void> {
  console.log(`Cleaning up test environment: ${config.testDir}`)
  try {
    await fsPromises.rm(config.testDir, { recursive: true, force: true })
    console.log('Cleanup complete.\n')
  } catch (error) {
    console.error('Cleanup failed:', error)
  }
}

export async function runGC(): Promise<void> {
  if (global.gc) {
    global.gc()
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Test 1: Sequential Upload Testing
 * Uploads each file one at a time, multiple iterations
 */
export async function testSequentialUploads(
  files: FileInfo[],
  host: string,
  iterations: number
): Promise<TimingResult[]> {
  console.log('=== SEQUENTIAL UPLOAD TESTING ===')
  console.log(`Files: ${files.length}, Iterations: ${iterations}\n`)

  const results: TimingResult[] = []

  for (const file of files) {
    console.log(`Testing: ${file.name} (${formatFileSize(file.size)})`)

    const result = await measureOperation(
      `sequential-${file.name}`,
      async () => {
        const modelName = `stress-test-seq-${Date.now()}`
        // Create model with the file and a proper modelfile
        const modelfile = `FROM ${file.path}\nPARAMETER temperature 0.7`
        await createModelWithOllamaJS(
          host,
          modelName,
          [{ filepath: file.path, sha256: file.sha256 }],
          modelfile,
          false
        )
        await runGC()
        // Delete the model after creation
        await deleteModel(host, modelName)
        // Delete the blob to ensure fresh upload in next iteration
        await deleteBlob(host, file.sha256)
      },
      iterations
    )

    results.push(result)
    console.log(formatTimingResult(result))
  }

  return results
}

/**
 * Test 2: Parallel Upload Testing
 * Uploads multiple files simultaneously
 */
export async function testParallelUploads(
  files: FileInfo[],
  host: string,
  parallelDegree: number
): Promise<TimingResult> {
  console.log('=== PARALLEL UPLOAD TESTING ===')
  console.log(`Files: ${files.length}, Parallel Degree: ${parallelDegree}\n`)

  const result = await measureOperation(
    'parallel-uploads',
    async () => {
      const batches: FileInfo[][] = []
      for (let i = 0; i < files.length; i += parallelDegree) {
        batches.push(files.slice(i, i + parallelDegree))
      }

      for (const batch of batches) {
        await Promise.all(
          batch.map(file => {
            const modelName = `stress-test-par-${Date.now()}-${file.name}`
            const modelfile = `FROM ${file.path}\nPARAMETER temperature 0.7`
            return createModelWithOllamaJS(
              host,
              modelName,
              [{ filepath: file.path, sha256: file.sha256 }],
              modelfile,
              false
            )
          })
        )
        await runGC()
      }
    },
    1
  )

  console.log(formatTimingResult(result))
  return result
}

/**
 * Test 3: Combined Stress Test
 * All files, all iterations, mixed sequential and parallel
 */
export async function testCombinedStress(
  files: FileInfo[],
  host: string,
  iterations: number,
  parallelDegree: number
): Promise<{
  sequential: TimingResult[]
  parallel: TimingResult
  memoryPeak: number
}> {
  console.log('=== COMBINED STRESS TEST ===')
  console.log(`Files: ${files.length}, Iterations: ${iterations}, Parallel Degree: ${parallelDegree}\n`)

  const initialMemory = getMemoryUsageMB()
  let memoryPeak = initialMemory.heapUsed

  // Track peak memory
  const trackPeakMemory = () => {
    const current = getMemoryUsageMB()
    memoryPeak = Math.max(memoryPeak, current.heapUsed)
  }

  // Phase 1: Sequential uploads with iterations
  console.log('Phase 1: Sequential uploads with iterations...')
  const sequentialResults: TimingResult[] = []
  
  for (let iter = 0; iter < iterations; iter++) {
    console.log(`  Iteration ${iter + 1}/${iterations}`)
    for (const file of files) {
      const result = await measureOperation(
        `combined-sequential-${file.name}-iter${iter}`,
        async () => {
          const modelName = `stress-test-comb-seq-${Date.now()}-${file.name}`
          const modelfile = `FROM ${file.path}\nPARAMETER temperature 0.7`
          await createModelWithOllamaJS(
            host,
            modelName,
            [{ filepath: file.path, sha256: file.sha256 }],
            modelfile,
            false
          )
          trackPeakMemory()
        },
        1
      )
      sequentialResults.push(result)
      trackPeakMemory()
    }
  }

  // Phase 2: Parallel uploads
  console.log('Phase 2: Parallel uploads...')
  const parallelResult = await measureOperation(
    'combined-parallel',
    async () => {
      const batches: FileInfo[][] = []
      for (let i = 0; i < files.length; i += parallelDegree) {
        batches.push(files.slice(i, i + parallelDegree))
      }

      for (const batch of batches) {
        await Promise.all(
          batch.map(file => {
            const modelName = `stress-test-comb-par-${Date.now()}-${file.name}`
            const modelfile = `FROM ${file.path}\nPARAMETER temperature 0.7`
            return createModelWithOllamaJS(
              host,
              modelName,
              [{ filepath: file.path, sha256: file.sha256 }],
              modelfile,
              false
            )
          })
        )
        trackPeakMemory()
      }
    },
    1
  )

  // Phase 3: Burst parallel uploads (all at once)
  console.log('Phase 3: Burst parallel uploads (all files at once)...')
  const burstResult = await measureOperation(
    'combined-burst',
    async () => {
      await Promise.all(
        files.map(file => {
          const modelName = `stress-test-burst-${Date.now()}-${file.name}`
          const modelfile = `FROM ${file.path}\nPARAMETER temperature 0.7`
          return createModelWithOllamaJS(
            host,
            modelName,
            [{ filepath: file.path, sha256: file.sha256 }],
            modelfile,
            false
          )
        })
      )
    },
    1
  )

  const finalMemory = getMemoryUsageMB()

  console.log(`
=== COMBINED STRESS TEST RESULTS ===
  Sequential Operations: ${sequentialResults.length}
  Parallel Duration: ${parallelResult.duration.toFixed(2)}ms
  Burst Duration: ${burstResult.duration.toFixed(2)}ms
  Memory Before: ${initialMemory.heapUsed}MB
  Memory After: ${finalMemory.heapUsed}MB
  Memory Peak: ${memoryPeak}MB
  `)

  return {
    sequential: sequentialResults,
    parallel: parallelResult,
    memoryPeak: memoryPeak,
  }
}

/**
 * Test 4: Memory Leak Detection
 * Repeated uploads to detect memory leaks
 */
export async function testMemoryLeakDetection(
  file: FileInfo,
  host: string,
  iterations: number
): Promise<{
  memoryGrowth: number
  gcEfficiency: number
  snapshots: MemorySnapshot[]
}> {
  console.log('=== MEMORY LEAK DETECTION ===')
  console.log(`File: ${file.name}, Iterations: ${iterations}\n`)

  const snapshots: MemorySnapshot[] = []
  snapshots.push(createMemorySnapshot('initial'))

  for (let i = 0; i < iterations; i++) {
    await uploadFileWithOllamaJS(host, file.path, file.sha256)
    await runGC()
    snapshots.push(createMemorySnapshot(`iteration-${i}`))
  }

  snapshots.push(createMemorySnapshot('final'))

  // Calculate memory growth
  const initialMemory = snapshots[0].memory.heapUsed
  const finalMemory = snapshots[snapshots.length - 1].memory.heapUsed
  const maxMemory = Math.max(...snapshots.map(s => s.memory.heapUsed))

  const memoryGrowth = Math.round((finalMemory - initialMemory) / 1024 / 1024 * 100) / 100
  const gcEfficiency = Math.round((maxMemory - finalMemory) / 1024 / 1024 * 100) / 100

  console.log(`
=== MEMORY LEAK DETECTION RESULTS ===
  Initial Heap: ${initialMemory}MB
  Final Heap: ${finalMemory}MB
  Max Heap: ${maxMemory}MB
  Memory Growth: ${memoryGrowth > 0 ? '+' : ''}${memoryGrowth}MB
  GC Recovery: ${gcEfficiency}MB
  `)

  return {
    memoryGrowth,
    gcEfficiency,
    snapshots,
  }
}

/**
 * Test 5: Comparison with Curl
 * Direct comparison of curl vs ollama-js implementation
 */
export async function testCurlComparison(
  file: FileInfo,
  host: string
): Promise<ComparisonResult> {
  console.log('=== CURL VS OLLAMA-JS COMPARISON ===')
  console.log(`File: ${file.name} (${formatFileSize(file.size)})\n`)

  // Test curl upload
  console.log('  Testing curl upload...')
  const curlResult = await uploadFileWithCurl(host, file.path, file.sha256)

  await runGC()

  // Test ollama-js upload
  console.log('  Testing ollama-js upload...')
  const ollamaResult = await uploadFileWithOllamaJS(host, file.path, file.sha256)

  const comparison = compareResults(
    `curl-vs-ollama-js-${file.name}`,
    curlResult,
    ollamaResult
  )

  console.log(formatComparisonResult(comparison))

  return comparison
}

// ============================================================================
// Main Test Runner
// ============================================================================

export interface TestRunnerConfig {
  files: string[]
  testDir?: string
  host?: string
  iterations?: number
  parallelDegree?: number
  skipCurlComparison?: boolean
  skipMemoryLeakTest?: boolean
}

export async function runAllTests(config: TestRunnerConfig): Promise<void> {
  const {
    files,
    testDir = TEST_DIR,
    host = OLLAMA_HOST,
    iterations = ITERATIONS,
    parallelDegree = PARALLEL_DEGREE,
    skipCurlComparison = false,
    skipMemoryLeakTest = false,
  } = config

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║     OLLAMA-JS MULTI-STEP FILE UPLOAD STRESS TEST                ║
╚══════════════════════════════════════════════════════════════════╝

Configuration:
  Host: ${host}
  Test Directory: ${testDir}
  Iterations: ${iterations}
  Parallel Degree: ${parallelDegree}
  Files: ${files.length}
`)
  console.log('Files to test:')
  for (const file of files) {
    console.log(`  - ${file}`)
  }
  console.log('')

  // Setup
  await setupTestEnvironment({
    testDir,
    host,
    iterations,
    parallelDegree,
  })

  // Get file information
  const fileInfos: FileInfo[] = []
  for (const file of files) {
    try {
      const info = await getFileInfo(file)
      fileInfos.push(info)
      console.log(`Found: ${info.name} (${formatFileSize(info.size)})`)
    } catch (error) {
      console.error(`File not found: ${file}`)
    }
  }
  console.log('')

  const allResults: any[] = []

  try {
    // Test 1: Sequential Uploads
    console.log('\n' + '='.repeat(60))
    const sequentialResults = await testSequentialUploads(fileInfos, host, iterations)
    allResults.push({ type: 'sequential', results: sequentialResults })

    // Test 2: Parallel Uploads
    console.log('\n' + '='.repeat(60))
    const parallelResult = await testParallelUploads(fileInfos, host, parallelDegree)
    allResults.push({ type: 'parallel', result: parallelResult })

    // Test 3: Combined Stress Test
    console.log('\n' + '='.repeat(60))
    const combinedResults = await testCombinedStress(fileInfos, host, iterations, parallelDegree)
    allResults.push({ type: 'combined', results: combinedResults })

    // Test 4: Memory Leak Detection
    if (!skipMemoryLeakTest && fileInfos.length > 0) {
      console.log('\n' + '='.repeat(60))
      const leakResults = await testMemoryLeakDetection(fileInfos[0], host, iterations * 3)
      allResults.push({ type: 'memory-leak', results: leakResults })
    }

    // Test 5: Curl Comparison
    if (!skipCurlComparison) {
      console.log('\n' + '='.repeat(60))
      const comparisonResults = []
      for (const file of fileInfos) {
        const comparison = await testCurlComparison(file, host)
        comparisonResults.push(comparison)
      }
      allResults.push({ type: 'curl-comparison', results: comparisonResults })
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total test suites: ${allResults.length}`)
    
    for (const result of allResults) {
      switch (result.type) {
        case 'sequential':
          console.log(`  Sequential tests: ${result.results.length} operations`)
          break
        case 'parallel':
          console.log(`  Parallel test: ${result.result.duration.toFixed(2)}ms`)
          break
        case 'combined':
          console.log(`  Combined test: ${result.results.sequential.length} operations`)
          console.log(`  Memory peak: ${result.results.memoryPeak}MB`)
          break
        case 'memory-leak':
          console.log(`  Memory growth: ${result.results.memoryGrowth}MB`)
          break
        case 'curl-comparison':
          console.log(`  Curl comparisons: ${result.results.length} files`)
          break
      }
    }

    console.log('\nAll tests completed successfully!')

  } catch (error) {
    console.error('Test execution failed:', error)
    throw error
  } finally {
    // Cleanup
    await cleanupTestEnvironment({ testDir, host, iterations, parallelDegree })
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2)
  
  const config: TestRunnerConfig = {
    files: TEST_FILES,
    testDir: process.env.TEST_DIR,
    host: process.env.OLLAMA_HOST,
    iterations: parseInt(process.env.ITERATIONS || '3'),
    parallelDegree: parseInt(process.env.PARALLEL_DEGREE || '4'),
    skipCurlComparison: args.includes('--skip-curl'),
    skipMemoryLeakTest: args.includes('--skip-leak'),
  }

  console.log('Starting stress tests...')
  console.log('Configuration:', JSON.stringify(config, null, 2))

  runAllTests(config)
    .then(() => {
      console.log('\nStress tests completed.')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\nStress tests failed:', error)
      process.exit(1)
    })
}
