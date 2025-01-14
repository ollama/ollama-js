import { describe, expect, it, beforeEach } from 'vitest'
import { MetricStorage, StoredReport, MetricPoint } from '../src/storage'
import { PerformanceReport } from '../src/reporting'

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    length: 0,
    key: vi.fn((i: number) => '')
  }
})()

// Mock console.warn to suppress storage warnings
console.warn = vi.fn()

describe('MetricStorage', () => {
  let storage: MetricStorage

  beforeEach(() => {
    vi.resetModules()
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
    localStorageMock.clear()
    storage = MetricStorage.getInstance()
    storage.clear()
  })

  afterEach(() => {
    storage.clear()
    vi.resetModules()
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = MetricStorage.getInstance()
      const instance2 = MetricStorage.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should maintain state across instances', () => {
      const report = createTestReport('test-op')
      storage.storeReport(report)
      
      const instance2 = MetricStorage.getInstance()
      const reports = instance2.queryReports()
      expect(reports).toHaveLength(1)
      expect(reports[0].report.operationId).toBe('test-op')
    })
  })

  describe('Basic Storage Operations', () => {
    it('should store and retrieve reports', () => {
      const report = createTestReport('test-op')
      storage.storeReport(report, 'test-source', ['tag1', 'tag2'])
      
      const reports = storage.queryReports()
      expect(reports).toHaveLength(1)
      expect(reports[0].report.operationId).toBe('test-op')
      expect(reports[0].source).toBe('test-source')
      expect(reports[0].tags).toEqual(['tag1', 'tag2'])
    })

    it('should handle multiple reports', () => {
      const reports = Array.from({ length: 5 }, (_, i) => 
        createTestReport(`test-op-${i}`)
      )
      
      reports.forEach(report => storage.storeReport(report))
      const stored = storage.queryReports()
      expect(stored).toHaveLength(5)
      stored.forEach((s, i) => {
        expect(s.report.operationId).toBe(`test-op-${i}`)
      })
    })

    it('should overwrite existing reports with same ID', () => {
      const report1 = createTestReport('test-op')
      const report2 = createTestReport('test-op')
      report2.duration = 2000

      storage.storeReport(report1)
      storage.storeReport(report2)

      const reports = storage.queryReports()
      expect(reports).toHaveLength(1)
      expect(reports[0].report.duration).toBe(2000)
    })
  })

  describe('Query Functionality', () => {
    it('should filter reports by source', () => {
      const report1 = createTestReport('test-op-1')
      const report2 = createTestReport('test-op-2')

      storage.storeReport(report1, 'source1')
      storage.storeReport(report2, 'source2')

      const source1Reports = storage.queryReports({ source: 'source1' })
      expect(source1Reports).toHaveLength(1)
      expect(source1Reports[0].report.operationId).toBe('test-op-1')

      const source2Reports = storage.queryReports({ source: 'source2' })
      expect(source2Reports).toHaveLength(1)
      expect(source2Reports[0].report.operationId).toBe('test-op-2')
    })

    it('should filter reports by tags', () => {
      const report = createTestReport('test-op')
      storage.storeReport(report, 'source', ['tag1', 'tag2'])

      const taggedReports = storage.queryReports({ tags: ['tag1'] })
      expect(taggedReports).toHaveLength(1)
      expect(taggedReports[0].tags).toContain('tag1')

      const nonMatchingReports = storage.queryReports({ tags: ['non-existent'] })
      expect(nonMatchingReports).toHaveLength(0)
    })

    it('should filter reports by time range', () => {
      const now = Date.now()
      const report1 = createTestReport('test-op-1')
      const report2 = createTestReport('test-op-2')
      
      report1.startTime = now - 2000
      report1.endTime = now - 1000
      report2.startTime = now - 1000
      report2.endTime = now

      storage.storeReport(report1)
      storage.storeReport(report2)

      const recentReports = storage.queryReports({ 
        timeRange: { start: now - 1500, end: now } 
      })
      expect(recentReports).toHaveLength(1)
      expect(recentReports[0].report.operationId).toBe('test-op-2')
    })

    it('should combine multiple filters', () => {
      const report1 = createTestReport('test-op-1')
      const report2 = createTestReport('test-op-2')
      
      storage.storeReport(report1, 'source1', ['tag1'])
      storage.storeReport(report2, 'source1', ['tag2'])

      const filteredReports = storage.queryReports({ 
        source: 'source1',
        tags: ['tag1']
      })
      expect(filteredReports).toHaveLength(1)
      expect(filteredReports[0].report.operationId).toBe('test-op-1')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid reports', () => {
      expect(() => {
        storage.storeReport(null as any)
      }).toThrow(StorageError)

      expect(() => {
        storage.storeReport({} as any)
      }).toThrow(StorageError)

      expect(() => {
        storage.storeReport({ ...createTestReport('test'), metrics: null } as any)
      }).toThrow(StorageError)
    })

    it('should handle invalid query parameters', () => {
      expect(() => {
        storage.queryReports({ timeRange: { start: 'invalid' } as any })
      }).toThrow(StorageError)

      expect(() => {
        storage.queryReports({ tags: 'invalid' as any })
      }).toThrow(StorageError)
    })

    it('should handle concurrent operations safely', async () => {
      const operations = 100
      const promises = Array.from({ length: operations }, async (_, i) => {
        const report = createTestReport(`test-op-${i}`)
        return storage.storeReport(report)
      })

      await Promise.all(promises)
      const reports = storage.queryReports()
      expect(reports).toHaveLength(operations)
    })
  })

  describe('Storage Management', () => {
    it('should enforce max entries limit', () => {
      const maxEntries = 1000 // Reduced for testing
      for (let i = 0; i < maxEntries + 10; i++) {
        storage.storeReport(createTestReport(`test-op-${i}`))
      }

      const reports = storage.queryReports()
      expect(reports).toHaveLength(maxEntries)
      // Verify we keep the most recent entries
      expect(reports[reports.length - 1].report.operationId).toBe(`test-op-${maxEntries + 9}`)
    })

    it('should cleanup old reports', () => {
      const now = Date.now()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const oldReport = createTestReport('old-op')
      oldReport.startTime = now - (90 * 24 * 60 * 60 * 1000) // 90 days old
      oldReport.endTime = oldReport.startTime + 1000

      const newReport = createTestReport('new-op')
      newReport.startTime = now - 1000
      newReport.endTime = now

      storage.storeReport(oldReport)
      storage.storeReport(newReport)
      storage.cleanup()

      const reports = storage.queryReports()
      expect(reports).toHaveLength(1)
      expect(reports[0].report.operationId).toBe('new-op')

      vi.useRealTimers()
    })

    it('should handle memory pressure', () => {
      const largeDataPoints = Array.from({ length: 10000 }, (_, i) => i)
      const report = createTestReport('large-op')
      report.metrics.latency.points = largeDataPoints
      
      storage.storeReport(report)
      const stored = storage.queryReports()[0]
      
      // Verify data is stored correctly
      expect(stored.report.metrics.latency.points).toHaveLength(10000)
      expect(stored.report.metrics.latency.points).toEqual(largeDataPoints)
    })
  })

  describe('Storage Persistence', () => {
    it('should persist data to localStorage', () => {
      const report = createTestReport('test-op')
      storage.storeReport(report)

      // Verify localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalled()
      
      // Verify data was stored correctly
      const storedData = JSON.parse(localStorageMock.getItem.mock.results[0].value)
      expect(storedData).toHaveLength(1)
      expect(storedData[0].report.operationId).toBe('test-op')
    })

    it('should load data from localStorage on initialization', () => {
      // Setup pre-existing data
      const existingReport = createTestReport('existing-op')
      localStorageMock.setItem('ollama-metrics', JSON.stringify([{
        report: existingReport,
        timestamp: Date.now()
      }]))

      // Create new instance
      const newStorage = MetricStorage.getInstance()
      const reports = newStorage.queryReports()
      
      expect(reports).toHaveLength(1)
      expect(reports[0].report.operationId).toBe('existing-op')
    })

    it('should handle localStorage errors gracefully', () => {
      // Simulate quota exceeded error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })

      const report = createTestReport('test-op')
      storage.storeReport(report)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalled()
      
      // Verify in-memory data is still intact
      const reports = storage.queryReports()
      expect(reports).toHaveLength(1)
    })

    it('should handle corrupted localStorage data', () => {
      // Setup corrupted data
      localStorageMock.setItem('ollama-metrics', 'invalid-json')

      // Create new instance
      const newStorage = MetricStorage.getInstance()
      
      // Should start fresh with empty storage
      const reports = newStorage.queryReports()
      expect(reports).toHaveLength(0)
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('Data Integrity', () => {
    it('should validate report structure', () => {
      const invalidReports = [
        { operationId: 'test' }, // Missing metrics
        { metrics: {} }, // Missing operationId
        { operationId: 'test', metrics: null }, // Invalid metrics
        { operationId: 'test', metrics: { invalidMetric: {} } } // Invalid metric type
      ]

      invalidReports.forEach(report => {
        expect(() => {
          storage.storeReport(report as any)
        }).toThrow(StorageError)
      })
    })

    it('should handle deep cloning of reports', () => {
      const report = createTestReport('test-op')
      const originalPoints = [1, 2, 3]
      report.metrics.latency.points = originalPoints

      storage.storeReport(report)
      
      // Modify original data
      originalPoints.push(4)
      report.metrics.latency.min = 999

      // Verify stored data is unchanged
      const stored = storage.queryReports()[0]
      expect(stored.report.metrics.latency.points).toHaveLength(3)
      expect(stored.report.metrics.latency.min).toBe(50)
    })

    it('should preserve numeric precision', () => {
      const report = createTestReport('test-op')
      const preciseValues = {
        tiny: 0.000000001,
        huge: 1e20,
        negative: -0.000000001
      }

      report.metrics.latency.min = preciseValues.tiny
      report.metrics.latency.max = preciseValues.huge
      report.metrics.memoryUsage.min = preciseValues.negative

      storage.storeReport(report)
      
      const stored = storage.queryReports()[0]
      expect(stored.report.metrics.latency.min).toBe(preciseValues.tiny)
      expect(stored.report.metrics.latency.max).toBe(preciseValues.huge)
      expect(stored.report.metrics.memoryUsage.min).toBe(preciseValues.negative)
    })

    it('should handle timezone-sensitive timestamps', () => {
      const report = createTestReport('test-op')
      const now = new Date('2025-01-09T15:56:05.000Z') // UTC time
      vi.setSystemTime(now)

      storage.storeReport(report)
      const stored = storage.queryReports()[0]
      
      // Verify timestamp is stored in milliseconds since epoch
      expect(stored.timestamp).toBe(now.getTime())
      
      // Verify timestamp remains consistent across timezones
      const timestamp = new Date(stored.timestamp)
      expect(timestamp.toISOString()).toBe('2025-01-09T15:56:05.000Z')
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const dataPoints = 10000
      const largeReport = createTestReport('large-op')
      largeReport.metrics.latency.points = Array.from({ length: dataPoints }, (_, i) => i)

      const startTime = performance.now()
      storage.storeReport(largeReport)
      const endTime = performance.now()

      // Verify storage operation completes in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100)

      const reports = storage.queryReports()
      expect(reports[0].report.metrics.latency.points).toHaveLength(dataPoints)
    })

    it('should clean up old data efficiently', () => {
      const now = Date.now()
      const reports = 10000
      
      // Create reports with varying ages
      for (let i = 0; i < reports; i++) {
        const report = createTestReport(`test-op-${i}`)
        const age = Math.floor(Math.random() * 60) // 0-60 days old
        const timestamp = now - (age * 24 * 60 * 60 * 1000)
        
        storage.storeReport(report)
        // Manually set timestamp for testing
        storage['reports'][i].timestamp = timestamp
      }

      const startTime = performance.now()
      storage.cleanup()
      const endTime = performance.now()

      // Verify cleanup operation completes in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle concurrent operations without data corruption', async () => {
      const operations = 1000
      const concurrentWrites = Array.from({ length: operations }, async (_, i) => {
        const report = createTestReport(`concurrent-op-${i}`)
        return storage.storeReport(report)
      })

      await Promise.all(concurrentWrites)
      
      const reports = storage.queryReports()
      const uniqueIds = new Set(reports.map(r => r.report.operationId))
      
      expect(reports).toHaveLength(operations)
      expect(uniqueIds.size).toBe(operations) // No duplicate IDs
    })
  })

  // Helper function to create test reports
  function createTestReport(operationId: string): PerformanceReport {
    return {
      operationId,
      duration: 1000,
      metrics: {
        latency: {
          min: 50,
          max: 150,
          avg: 100,
          count: 10,
          p50: 100,
          p95: 145,
          p99: 149,
          points: []
        },
        memoryUsage: {
          min: 512,
          max: 2048,
          avg: 1024,
          count: 10,
          p50: 1024,
          p95: 1900,
          p99: 2000,
          points: []
        },
        requestSize: {
          min: 256,
          max: 1024,
          avg: 512,
          count: 10,
          p50: 512,
          p95: 900,
          p99: 1000,
          points: []
        },
        responseSize: {
          min: 512,
          max: 2048,
          avg: 1024,
          count: 10,
          p50: 1024,
          p95: 1900,
          p99: 2000,
          points: []
        }
      },
      startTime: Date.now(),
      endTime: Date.now() + 1000,
      warnings: []
    }
  }
})
