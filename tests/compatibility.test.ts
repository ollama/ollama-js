import { describe, test, expect, beforeEach } from 'vitest'
import { PerformanceMonitor } from '../src/metrics'
import { MetricStorage } from '../src/storage'
import { PerformanceReport } from '../src/reporting'

describe('Compatibility Tests', () => {
  let monitor: PerformanceMonitor
  let storage: MetricStorage

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance()
    storage = MetricStorage.getInstance()
    monitor.clear()
    storage.clear()
  })

  test('Storage compatibility with monitor', () => {
    const operationId = monitor.startOperation('test-op')
    monitor.recordLatency(operationId, 100)
    monitor.recordMemoryUsage(operationId, 1024)
    
    const operation = monitor.getMetrics(operationId)
    expect(operation).toBeDefined()
    expect(operation?.metrics.latency).toBeDefined()
    expect(operation?.metrics.memoryUsage).toBeDefined()
    expect(operation?.metrics.latency.points).toHaveLength(1)
    expect(operation?.metrics.memoryUsage.points).toHaveLength(1)
  })

  test('Storage persistence', () => {
    const report: PerformanceReport = {
      operationId: 'test-op',
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
      }
    }
    storage.storeReport(report, 'test-source', ['tag1'])
    const reports = storage.queryReports({ source: 'test-source' })
    expect(reports).toHaveLength(1)
    expect(reports[0].report).toEqual(report)
    expect(reports[0].source).toBe('test-source')
    expect(reports[0].tags).toEqual(['tag1'])
  })

  test('Storage cleanup', () => {
    storage.clear()
    const reports = storage.queryReports()
    expect(reports).toHaveLength(0)
  })

  test('works in Node.js environment', () => {
    const opId = monitor.startOperation('node-test')
    expect(opId).toBeDefined()
    const report = monitor.endOperation(opId)
    expect(report).toBeDefined()
  })

  test('handles browser-like environment', () => {
    const opId = monitor.startOperation('browser-test')
    monitor.recordLatency(opId, 100)
    monitor.recordMemoryUsage(opId, 1024 * 1024)
    const report = monitor.endOperation(opId)
    expect(report).toBeDefined()
    expect(report.metrics.latency.points).toBeDefined()
    expect(report.metrics.memoryUsage.points).toBeDefined()
  })

  test('storage compatibility', () => {
    const opId = monitor.startOperation('storage-test')
    monitor.recordLatency(opId, 100)
    monitor.recordMemoryUsage(opId, 1024)
    const report = monitor.endOperation(opId)
    
    storage.storeReport(report, 'test-source', ['tag1'])
    const reports = storage.queryReports({ source: 'test-source' })
    expect(reports).toHaveLength(1)
    expect(reports[0].report).toEqual(report)
  })

  test('visualization compatibility', () => {
    const opId = monitor.startOperation('viz-test')
    for (let i = 0; i < 10; i++) {
      monitor.recordLatency(opId, 100 + i * 10)
      monitor.recordMemoryUsage(opId, 1024 + i * 100)
    }
    const operation = monitor.getMetrics(opId)
    expect(operation).toBeDefined()
    expect(operation?.metrics.latency.points).toHaveLength(10)
    expect(operation?.metrics.memoryUsage.points).toHaveLength(10)
  })
})
