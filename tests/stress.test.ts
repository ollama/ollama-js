import { describe, test, expect, beforeEach } from 'vitest'
import { PerformanceMonitor } from '../src/metrics'
import { MetricStorage } from '../src/storage'

describe('Performance Stress Tests', () => {
  let monitor: PerformanceMonitor
  let storage: MetricStorage

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance()
    storage = MetricStorage.getInstance()
    monitor.clear()
    storage.clear()
  })

  test('handles high volume of concurrent operations', async () => {
    const BATCH_SIZE = 100 // Process in smaller batches
    const TOTAL_OPERATIONS = 500 // Reduce total operations
    const batches = Math.ceil(TOTAL_OPERATIONS / BATCH_SIZE)
    
    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * BATCH_SIZE
      const endIdx = Math.min(startIdx + BATCH_SIZE, TOTAL_OPERATIONS)
      const promises = []

      for (let i = startIdx; i < endIdx; i++) {
        promises.push((async () => {
          const opId = monitor.startOperation(`stress-test-${i}`)
          monitor.recordLatency(opId, Math.random() * 100)
          monitor.recordMemoryUsage(opId, Math.random() * 1024 * 1024)
          monitor.recordRequestSize(opId, Math.random() * 5000)
          monitor.recordResponseSize(opId, Math.random() * 10000)
          
          // Simulate some async work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
          
          const report = monitor.endOperation(opId)
          expect(report).toBeDefined()
          expect(report.operationId).toBe(`stress-test-${i}`)
          expect(report.duration).toBeGreaterThan(0)
        })())
      }

      // Wait for all operations in this batch to complete
      await Promise.all(promises)
    }
  })

  test('handles rapid sequential operations', async () => {
    const OPERATIONS = 1000

    for (let i = 0; i < OPERATIONS; i++) {
      const opId = monitor.startOperation(`sequential-${i}`)
      monitor.recordLatency(opId, 1)
      monitor.recordMemoryUsage(opId, 1024)
      monitor.recordRequestSize(opId, 100)
      monitor.recordResponseSize(opId, 200)
      const report = monitor.endOperation(opId)
      
      expect(report).toBeDefined()
      expect(report.operationId).toBe(`sequential-${i}`)
    }
  })

  test('handles large metric values', () => {
    const opId = monitor.startOperation('large-values')
    
    // Test with large numbers
    monitor.recordLatency(opId, Number.MAX_SAFE_INTEGER)
    monitor.recordMemoryUsage(opId, Number.MAX_SAFE_INTEGER)
    monitor.recordRequestSize(opId, Number.MAX_SAFE_INTEGER)
    monitor.recordResponseSize(opId, Number.MAX_SAFE_INTEGER)
    
    const report = monitor.endOperation(opId)
    expect(report).toBeDefined()
    expect(report.metrics.latency).toBe(Number.MAX_SAFE_INTEGER)
    expect(report.metrics.memoryUsage).toBe(Number.MAX_SAFE_INTEGER)
    expect(report.metrics.requestSize).toBe(Number.MAX_SAFE_INTEGER)
    expect(report.metrics.responseSize).toBe(Number.MAX_SAFE_INTEGER)
  })

  test('handles concurrent read/write operations', async () => {
    const CONCURRENT_OPS = 100
    const promises = []

    for (let i = 0; i < CONCURRENT_OPS; i++) {
      promises.push((async () => {
        const opId = monitor.startOperation(`concurrent-${i}`)
        
        // Write operations
        monitor.recordLatency(opId, Math.random() * 100)
        monitor.recordMemoryUsage(opId, Math.random() * 1024)
        
        // Simulate concurrent read operations
        const allMetrics = storage.getAllMetrics()
        expect(allMetrics).toBeDefined()
        
        // More write operations
        monitor.recordRequestSize(opId, Math.random() * 1000)
        monitor.recordResponseSize(opId, Math.random() * 2000)
        
        const report = monitor.endOperation(opId)
        expect(report).toBeDefined()
      })())
    }

    await Promise.all(promises)
  })

  test('handles error conditions gracefully', () => {
    const opId = monitor.startOperation('error-test')
    
    // Test invalid metric values
    monitor.recordLatency(opId, -1)
    monitor.recordMemoryUsage(opId, -1000)
    monitor.recordRequestSize(opId, -50)
    monitor.recordResponseSize(opId, -100)
    
    const report = monitor.endOperation(opId)
    expect(report).toBeDefined()
    expect(report.metrics.latency).toBe(0)
    expect(report.metrics.memoryUsage).toBe(0)
    expect(report.metrics.requestSize).toBe(0)
    expect(report.metrics.responseSize).toBe(0)
  })
})
