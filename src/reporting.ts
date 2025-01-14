import { Operation, MetricReport, MetricPoint } from './metrics'

interface MetricSummary {
  min: number
  max: number
  avg: number
  count: number
  p50: number
  p95: number
  p99: number
}

/**
 * Calculates summary statistics for an array of metric points
 */
function calculateMetricSummary(points: { timestamp: number; value: number }[]): MetricSummary {
  if (!points || points.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      count: 0,
      p50: 0,
      p95: 0,
      p99: 0
    }
  }

  const values = points.map(p => p.value).sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)

  return {
    min: values[0],
    max: values[values.length - 1],
    avg: sum / values.length,
    count: values.length,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    p99: values[Math.floor(values.length * 0.99)]
  }
}

export interface PerformanceReport {
  operationId: string
  startTime: number
  endTime: number
  duration: number
  source?: string
  tags?: string[]
  warnings: { message: string; timestamp: number }[]
  metrics: {
    latency: MetricReport & { points: MetricPoint[] }
    memoryUsage: MetricReport & { points: MetricPoint[] }
    requestSize: MetricReport & { points: MetricPoint[] }
    responseSize: MetricReport & { points: MetricPoint[] }
  }
}

/**
 * Generates a performance report from operation metrics
 */
export function generateReport(
  operation: Operation,
  duration: number,
  source?: string,
  tags?: string[]
): PerformanceReport {
  return {
    operationId: operation.id,
    startTime: operation.startTime,
    endTime: operation.startTime + duration,
    duration,
    source,
    tags,
    warnings: operation.warnings,
    metrics: {
      latency: {
        ...operation.metrics.latency,
        points: [...operation.metrics.latency.points]
      },
      memoryUsage: {
        ...operation.metrics.memoryUsage,
        points: [...operation.metrics.memoryUsage.points]
      },
      requestSize: {
        ...operation.metrics.requestSize,
        points: [...operation.metrics.requestSize.points]
      },
      responseSize: {
        ...operation.metrics.responseSize,
        points: [...operation.metrics.responseSize.points]
      }
    }
  }
}

export function formatMetricValue(value: number, metricName: string): string {
  if (metricName === 'latency') {
    return `${value.toFixed(2)}ms`
  }

  // Format sizes (memory, request, response)
  if (value < 1024) {
    return `${value.toFixed(2)}B`
  } else if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)}KB`
  } else {
    return `${(value / (1024 * 1024)).toFixed(2)}MB`
  }
}

export function formatReport(report: PerformanceReport): string {
  const lines: string[] = [
    `Performance Report for ${report.operationId}`,
    `Duration: ${formatMetricValue(report.duration, 'latency')}`,
    '',
    'Metrics:',
    `  Latency:`,
    `    Min: ${formatMetricValue(report.metrics.latency.min, 'latency')}`,
    `    Max: ${formatMetricValue(report.metrics.latency.max, 'latency')}`,
    `    Avg: ${formatMetricValue(report.metrics.latency.avg, 'latency')}`,
    `    P50: ${formatMetricValue(report.metrics.latency.p50, 'latency')}`,
    `    P95: ${formatMetricValue(report.metrics.latency.p95, 'latency')}`,
    `    P99: ${formatMetricValue(report.metrics.latency.p99, 'latency')}`,
    `    Points: ${report.metrics.latency.points.length}`,
    '',
    `  Memory Usage:`,
    `    Min: ${formatMetricValue(report.metrics.memoryUsage.min, 'memoryUsage')}`,
    `    Max: ${formatMetricValue(report.metrics.memoryUsage.max, 'memoryUsage')}`,
    `    Avg: ${formatMetricValue(report.metrics.memoryUsage.avg, 'memoryUsage')}`,
    `    Points: ${report.metrics.memoryUsage.points.length}`,
    '',
    `  Request Size:`,
    `    Min: ${formatMetricValue(report.metrics.requestSize.min, 'requestSize')}`,
    `    Max: ${formatMetricValue(report.metrics.requestSize.max, 'requestSize')}`,
    `    Avg: ${formatMetricValue(report.metrics.requestSize.avg, 'requestSize')}`,
    `    Points: ${report.metrics.requestSize.points.length}`,
    '',
    `  Response Size:`,
    `    Min: ${formatMetricValue(report.metrics.responseSize.min, 'responseSize')}`,
    `    Max: ${formatMetricValue(report.metrics.responseSize.max, 'responseSize')}`,
    `    Avg: ${formatMetricValue(report.metrics.responseSize.avg, 'responseSize')}`,
    `    Points: ${report.metrics.responseSize.points.length}`
  ]

  if (report.warnings && report.warnings.length > 0) {
    lines.push('', 'Warnings:')
    report.warnings.forEach(warning => {
      lines.push(`  - ${warning.message} (at ${new Date(warning.timestamp).toISOString()})`)
    })
  }

  if (report.tags && report.tags.length > 0) {
    lines.push('', 'Tags:', `  ${report.tags.join(', ')}`)
  }

  return lines.join('\n')
}
