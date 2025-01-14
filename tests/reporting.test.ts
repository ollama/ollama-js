import { describe, it, expect } from 'vitest'
import { Operation } from '../src/metrics'
import { MetricPoint } from '../src/types'
import { generateReport, formatMetricValue, formatReport } from '../src/reporting'

describe('reporting', () => {
  const createOperation = (metrics: Partial<Operation['metrics']> = {}): Operation => {
    const startTime = Date.now();
    const endTime = startTime + 1000;
    return {
      id: 'test-op',
      startTime,
      endTime,
      duration: endTime - startTime,
      warnings: [],
      metrics: {
        latency: {
          min: 0,
          max: 0,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: [],
          ...metrics.latency
        },
        memoryUsage: {
          min: 0,
          max: 0,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: [],
          ...metrics.memoryUsage
        },
        requestSize: {
          min: 0,
          max: 0,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: [],
          ...metrics.requestSize
        },
        responseSize: {
          min: 0,
          max: 0,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: [],
          ...metrics.responseSize
        }
      }
    }
  }

  describe('generateReport', () => {
    it('should generate a report with empty metrics', () => {
      const operation = createOperation()
      const duration = 1000
      const report = generateReport(operation, duration)

      expect(report).toEqual({
        operationId: operation.id,
        startTime: operation.startTime,
        endTime: operation.startTime + duration,
        duration,
        warnings: [],
        metrics: {
          latency: {
            min: 0,
            max: 0,
            avg: 0,
            count: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            points: []
          },
          memoryUsage: {
            min: 0,
            max: 0,
            avg: 0,
            count: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            points: []
          },
          requestSize: {
            min: 0,
            max: 0,
            avg: 0,
            count: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            points: []
          },
          responseSize: {
            min: 0,
            max: 0,
            avg: 0,
            count: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            points: []
          }
        }
      })
    })

    it('should generate a report with metrics', () => {
      const points: MetricPoint[] = [
        { timestamp: Date.now(), value: 100 },
        { timestamp: Date.now(), value: 200 },
        { timestamp: Date.now(), value: 300 }
      ]

      const operation = createOperation({
        latency: {
          min: 100,
          max: 300,
          avg: 200,
          count: 3,
          p50: 200,
          p95: 300,
          p99: 300,
          points
        }
      })

      const duration = 1000
      const source = 'test'
      const tags = ['test']
      const report = generateReport(operation, duration, source, tags)

      expect(report.metrics.latency.points).toEqual(points)
      expect(report.source).toBe(source)
      expect(report.tags).toEqual(tags)
    })
  })

  describe('formatMetricValue', () => {
    it('should format latency values', () => {
      expect(formatMetricValue(100.123, 'latency')).toBe('100.12ms')
      expect(formatMetricValue(0, 'latency')).toBe('0.00ms')
    })

    it('should format memory values', () => {
      expect(formatMetricValue(1024, 'memoryUsage')).toBe('1.00 KB')
      expect(formatMetricValue(1024 * 1024, 'memoryUsage')).toBe('1.00 MB')
    })

    it('should format size values', () => {
      expect(formatMetricValue(1024, 'requestSize')).toBe('1.00 KB')
      expect(formatMetricValue(1024, 'responseSize')).toBe('1.00 KB')
    })
  })

  describe('formatReport', () => {
    it('should format a report with metrics', () => {
      const operation = createOperation({
        latency: {
          min: 100,
          max: 300,
          avg: 200,
          count: 3,
          p50: 200,
          p95: 300,
          p99: 300,
          points: [
            { timestamp: Date.now(), value: 100 },
            { timestamp: Date.now(), value: 200 },
            { timestamp: Date.now(), value: 300 }
          ]
        }
      })

      const report = generateReport(operation, 1000, 'test', ['test'])
      const formatted = formatReport(report)

      expect(formatted).toContain('Operation ID: test-op')
      expect(formatted).toContain('Source: test')
      expect(formatted).toContain('Tags: test')
      expect(formatted).toContain('Duration: 1000ms')
      expect(formatted).toContain('Latency:')
      expect(formatted).toContain('Min: 100.00ms')
      expect(formatted).toContain('Max: 300.00ms')
      expect(formatted).toContain('Avg: 200.00ms')
    })
  })
})
