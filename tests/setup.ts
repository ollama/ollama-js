/**
 * Test setup and configuration
 */

import { TextEncoder, TextDecoder } from 'util'
import { EventEmitter } from 'events'
import { beforeEach, afterEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
}

global.localStorage = localStorageMock as Storage

// Mock performance
const performanceMock = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  timeOrigin: Date.now()
}

global.performance = performanceMock as any

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock ReadableStream with proper async iterator support
class MockReadableStream {
  constructor(private source?: UnderlyingSource) {}

  getReader() {
    const reader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      closed: Promise.resolve(undefined),
      releaseLock: vi.fn()
    };
    return reader;
  }

  [Symbol.asyncIterator]() {
    const reader = this.getReader();
    return {
      next: () => reader.read(),
      return: () => {
        reader.releaseLock();
        return Promise.resolve({ done: true, value: undefined });
      },
      throw: () => Promise.reject(new Error('Stream error'))
    };
  }
}

global.ReadableStream = MockReadableStream as any;

// Mock TextEncoder/Decoder with proper implementations
class MockTextEncoder {
  encode(input?: string): Uint8Array {
    return new Uint8Array(Buffer.from(input || ''));
  }
}

class MockTextDecoder {
  decode(input?: BufferSource): string {
    if (!input) return '';
    return Buffer.from(input as Uint8Array).toString();
  }
}

global.TextEncoder = MockTextEncoder as any;
global.TextDecoder = MockTextDecoder as any;

// Mock Headers with proper implementation
class MockHeaders {
  private headers: Map<string, string> = new Map();

  constructor(init?: Record<string, string>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  get(key: string): string | null {
    return this.headers.get(key.toLowerCase()) || null;
  }

  set(key: string, value: string): void {
    this.headers.set(key.toLowerCase(), value);
  }
}

global.Headers = MockHeaders as any;

// Mock Response with proper implementation
class MockResponse {
  constructor(
    public body: MockReadableStream | null = null,
    public init: ResponseInit = {}
  ) {}

  get ok(): boolean {
    return (this.init.status || 200) >= 200 && (this.init.status || 200) < 300;
  }

  get status(): number {
    return this.init.status || 200;
  }

  get headers(): Headers {
    return new MockHeaders(this.init.headers as Record<string, string>);
  }

  async text(): Promise<string> {
    return '';
  }

  async json(): Promise<any> {
    return {};
  }
}

global.Response = MockResponse as any;

// Mock Event for abort events
class MockEvent {
  constructor(public type: string) {}
}

// Mock EventTarget for proper event handling
class MockEventTarget extends EventEmitter {
  addEventListener(type: string, listener: EventListener): void {
    this.on(type, listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.off(type, listener);
  }

  dispatchEvent(event: Event): boolean {
    return this.emit(event.type, event);
  }
}

// Mock AbortSignal with proper implementation
class MockAbortSignal extends MockEventTarget {
  aborted: boolean = false;
  reason: any = undefined;
  onabort: ((this: AbortSignal, ev: Event) => any) | null = null;

  constructor() {
    super();
    this.addEventListener = this.addEventListener.bind(this);
    this.removeEventListener = this.removeEventListener.bind(this);
    this.dispatchEvent = this.dispatchEvent.bind(this);
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason;
    }
  }

  get [Symbol.toStringTag]() {
    return 'AbortSignal';
  }
}

// Mock AbortController with proper implementation
class MockAbortController {
  readonly signal: MockAbortSignal;

  constructor() {
    this.signal = new MockAbortSignal();
  }

  abort(reason?: any): void {
    if (this.signal.aborted) return;
    
    this.signal.aborted = true;
    this.signal.reason = reason ?? new Error('The operation was aborted');
    
    const event = new MockEvent('abort');
    if (this.signal.onabort) {
      this.signal.onabort.call(this.signal, event);
    }
    this.signal.dispatchEvent(event);
  }
}

// Set up global mocks
global.Event = MockEvent as any;
global.EventTarget = MockEventTarget as any;
global.AbortController = MockAbortController as any;

// Setup global mocks
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();
  performanceMock.now.mockReturnValue(Date.now());
  mockFetch.mockReset();
});

// Cleanup after each test
afterEach(() => {
  vi.resetAllMocks()
  localStorageMock.clear()
})

// Test utilities
export const createMockResponse = (data: any, options: { ok?: boolean; status?: number } = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: async () => data
})

export const createMockError = (message: string, status = 500) => ({
  ok: false,
  status,
  json: async () => ({ error: message })
})

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const mockPerformanceNow = (timestamp: number) => {
  performanceMock.now.mockImplementation(() => timestamp)
}

export const mockLocalStorage = (initialData: { [key: string]: any } = {}) => {
  Object.entries(initialData).forEach(([key, value]) => {
    localStorageMock.setItem(key, JSON.stringify(value))
  })
}

export const mockFetchError = (message: string, status = 500) => {
  global.fetch.mockImplementation(async () => createMockError(message, status))
}

// Test constants
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_INTERVAL: 100,
  MAX_RETRIES: 3
}

// Test helpers
export const retryUntil = async <T>(
  fn: () => T | Promise<T>,
  predicate: (result: T) => boolean,
  options: {
    timeout?: number
    interval?: number
    maxRetries?: number
  } = {}
): Promise<T> => {
  const timeout = options.timeout ?? TEST_CONSTANTS.DEFAULT_TIMEOUT
  const interval = options.interval ?? TEST_CONSTANTS.DEFAULT_INTERVAL
  const maxRetries = options.maxRetries ?? TEST_CONSTANTS.MAX_RETRIES

  const startTime = Date.now()
  let retries = 0

  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition (${timeout}ms)`)
    }

    if (retries >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded`)
    }

    const result = await fn()
    if (predicate(result)) {
      return result
    }

    await sleep(interval)
    retries++
  }
}

// Export test utilities
export {
  localStorageMock,
  performanceMock,
  mockFetch
}

// Enhanced types for mocks
interface StorageMock {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
  [key: string]: any
  // Error simulation
  simulateQuotaExceeded?: boolean
  simulateCorruption?: boolean
  simulateNetworkError?: boolean
}

interface PerformanceMock {
  now(): number
  mark(markName: string): void
  measure(measureName: string, startMark?: string, endMark?: string): void
  getEntriesByName(name: string, type?: string): PerformanceEntry[]
  clearMarks(markName?: string): void
  clearMeasures(measureName?: string): void
  memory: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
  timeOrigin: number
  // Memory leak detection
  getMemoryUsage(): { leaked: boolean; leakSize: number }
  // Network condition simulation
  setNetworkCondition(condition: 'fast' | 'slow' | 'offline'): void
}

interface NetworkMock {
  online: boolean
  type: 'wifi' | '4g' | '3g' | '2g' | 'slow-2g' | 'offline'
  downlink: number
  rtt: number
  saveData: boolean
}

interface WindowMock {
  performance: PerformanceMock
  localStorage: StorageMock
  sessionStorage: StorageMock
  navigator: {
    connection: NetworkMock
    userAgent: string
    language: string
    languages: string[]
  }
}

// Polyfill TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Create enhanced storage mock with error simulation
const createStorageMock = (): StorageMock => {
  const store = new Map<string, string>()
  let quotaExceeded = false
  let corruption = false
  let networkError = false

  const storage: StorageMock = {
    getItem: vi.fn((key: string) => {
      if (networkError) throw new Error('Network error')
      if (corruption) return 'invalid-json'
      return store.get(key) ?? null
    }),

    setItem: vi.fn((key: string, value: string) => {
      if (quotaExceeded) throw new Error('QuotaExceededError')
      if (networkError) throw new Error('Network error')
      store.set(key, String(value))
    }),

    removeItem: vi.fn((key: string) => {
      if (networkError) throw new Error('Network error')
      store.delete(key)
    }),

    clear: vi.fn(() => {
      if (networkError) throw new Error('Network error')
      store.clear()
    }),

    key: vi.fn((index: number) => {
      if (networkError) throw new Error('Network error')
      const keys = Array.from(store.keys())
      return keys[index] || null
    }),

    get length() {
      return store.size
    },

    // Error simulation controls
    set simulateQuotaExceeded(value: boolean) {
      quotaExceeded = value
    },

    set simulateCorruption(value: boolean) {
      corruption = value
    },

    set simulateNetworkError(value: boolean) {
      networkError = value
    }
  }

  return storage
}

// Create enhanced performance mock with memory leak detection
const createPerformanceMock = (): PerformanceMock => {
  let startTime = Date.now()
  const marks = new Map<string, number>()
  const measures = new Map<string, { start: number; duration: number }>()
  let memoryUsage = {
    usedJSHeapSize: 0,
    totalJSHeapSize: 1024 * 1024 * 1024, // 1GB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
  }
  let networkCondition: 'fast' | 'slow' | 'offline' = 'fast'

  const performance: PerformanceMock = {
    now: vi.fn(() => Date.now() - startTime),

    mark: vi.fn((markName: string) => {
      marks.set(markName, Date.now() - startTime)
    }),

    measure: vi.fn((measureName: string, startMark?: string, endMark?: string) => {
      const start = startMark ? marks.get(startMark) ?? 0 : 0
      const end = endMark ? marks.get(endMark) ?? performance.now() : performance.now()
      measures.set(measureName, { start, duration: end - start })
    }),

    getEntriesByName: vi.fn((name: string, type?: string) => {
      if (type === 'mark') {
        return marks.has(name) ? [{ name, startTime: marks.get(name)! }] : []
      }
      if (type === 'measure') {
        const measure = measures.get(name)
        return measure ? [{ name, startTime: measure.start, duration: measure.duration }] : []
      }
      return []
    }),

    clearMarks: vi.fn((markName?: string) => {
      if (markName) {
        marks.delete(markName)
      } else {
        marks.clear()
      }
    }),

    clearMeasures: vi.fn((measureName?: string) => {
      if (measureName) {
        measures.delete(measureName)
      } else {
        measures.clear()
      }
    }),

    get memory() {
      return { ...memoryUsage }
    },

    timeOrigin: startTime,

    // Memory leak detection
    getMemoryUsage: vi.fn(() => {
      const leaked = memoryUsage.usedJSHeapSize > 0.9 * memoryUsage.totalJSHeapSize
      return {
        leaked,
        leakSize: leaked ? memoryUsage.usedJSHeapSize - (0.9 * memoryUsage.totalJSHeapSize) : 0
      }
    }),

    // Network condition simulation
    setNetworkCondition: vi.fn((condition: 'fast' | 'slow' | 'offline') => {
      networkCondition = condition
      switch (condition) {
        case 'fast':
          memoryUsage.usedJSHeapSize = 0.5 * memoryUsage.totalJSHeapSize
          break
        case 'slow':
          memoryUsage.usedJSHeapSize = 0.8 * memoryUsage.totalJSHeapSize
          break
        case 'offline':
          memoryUsage.usedJSHeapSize = 0.95 * memoryUsage.totalJSHeapSize
          break
      }
    })
  }

  return performance
}

// Create network mock with condition simulation
const createNetworkMock = (): NetworkMock => {
  return {
    online: true,
    type: 'wifi',
    downlink: 10,
    rtt: 50,
    saveData: false
  }
}

// Create enhanced window mock
const mockWindow: WindowMock = {
  performance: createPerformanceMock(),
  localStorage: createStorageMock(),
  sessionStorage: createStorageMock(),
  navigator: {
    connection: createNetworkMock(),
    userAgent: 'Mozilla/5.0 (Test)',
    language: 'en-US',
    languages: ['en-US', 'en']
  }
}

// Global test utilities
export const TestUtils = {
  // Reset all mocks to initial state
  resetMocks: () => {
    mockWindow.localStorage.clear()
    mockWindow.sessionStorage.clear()
    mockWindow.performance.clearMarks()
    mockWindow.performance.clearMeasures()
    mockWindow.performance.setNetworkCondition('fast')
  },

  // Simulate different network conditions
  simulateNetwork: (condition: 'fast' | 'slow' | 'offline') => {
    mockWindow.performance.setNetworkCondition(condition)
    mockWindow.navigator.connection.online = condition !== 'offline'
    switch (condition) {
      case 'fast':
        mockWindow.navigator.connection.type = 'wifi'
        mockWindow.navigator.connection.downlink = 10
        mockWindow.navigator.connection.rtt = 50
        break
      case 'slow':
        mockWindow.navigator.connection.type = '3g'
        mockWindow.navigator.connection.downlink = 1
        mockWindow.navigator.connection.rtt = 300
        break
      case 'offline':
        mockWindow.navigator.connection.type = 'offline'
        mockWindow.navigator.connection.downlink = 0
        mockWindow.navigator.connection.rtt = 0
        break
    }
  },

  // Simulate storage errors
  simulateStorageError: (type: 'quota' | 'corruption' | 'network') => {
    switch (type) {
      case 'quota':
        mockWindow.localStorage.simulateQuotaExceeded = true
        break
      case 'corruption':
        mockWindow.localStorage.simulateCorruption = true
        break
      case 'network':
        mockWindow.localStorage.simulateNetworkError = true
        break
    }
  },

  // Check for memory leaks
  checkMemoryLeaks: () => mockWindow.performance.getMemoryUsage()
}

// Expose mocks to global scope
Object.defineProperty(global, 'window', { value: mockWindow })
Object.defineProperty(global, 'localStorage', { value: mockWindow.localStorage })
Object.defineProperty(global, 'sessionStorage', { value: mockWindow.sessionStorage })
Object.defineProperty(global, 'performance', { value: mockWindow.performance })
Object.defineProperty(global, 'navigator', { value: mockWindow.navigator })
