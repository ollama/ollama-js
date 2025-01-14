/**
 * Performance monitoring system for Ollama operations
 * @module metrics
 */

import { ValidationError } from './errors'
import { generateReport, PerformanceReport } from './reporting'
import { MetricStorage } from './storage'
import { ChartGenerator } from './visualization'
import { MetricPoint, StoredReport } from './types'

/**
 * Types of metrics that can be collected
 * @enum {string}
 */
export enum MetricName {
  Latency = 'latency',
  MemoryUsage = 'memoryUsage',
  RequestSize = 'requestSize',
  ResponseSize = 'responseSize'
}

/**
 * Single data point for a metric
 * @interface MetricPoint
 */
export interface MetricPoint {
  /** Timestamp when the metric was recorded */
  timestamp: number
  /** Value of the metric */
  value: number
}

/**
 * Represents a complete operation with its metrics
 * @interface Operation
 */
export interface Operation {
  /** Unique identifier for the operation */
  id: string
  /** Start time of the operation */
  startTime: number
  /** End time of the operation */
  endTime: number
  /** Duration of the operation */
  duration: number
  /** Collection of warnings for this operation */
  warnings: { message: string; timestamp: number }[]
  /** Collection of metrics for this operation */
  metrics: {
    latency: MetricReport & { points: MetricPoint[] }
    memoryUsage: MetricReport & { points: MetricPoint[] }
    requestSize: MetricReport & { points: MetricPoint[] }
    responseSize: MetricReport & { points: MetricPoint[] }
  }
}

/**
 * Represents a report for an operation
 * @interface OperationMetrics
 */
export interface OperationMetrics {
  latency: MetricPoint[]
  memoryUsage: MetricPoint[]
  requestSize: MetricPoint[]
  responseSize: MetricPoint[]
}

/**
 * Represents a metric report
 * @interface MetricReport
 */
export interface MetricReport {
  /** Minimum value of the metric */
  min: number
  /** Maximum value of the metric */
  max: number
  /** Average value of the metric */
  avg: number
  /** Number of data points for the metric */
  count: number
  /** 50th percentile of the metric */
  p50: number
  /** 95th percentile of the metric */
  p95: number
  /** 99th percentile of the metric */
  p99: number
}

/**
 * Error class for metrics-related errors
 * @class MetricsError
 * @extends {ValidationError}
 */
export class MetricsError extends ValidationError {
  /**
   * Creates an instance of MetricsError
   * @param {string} message - Error message
   * @param {unknown} [details] - Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, details)
  }
}

/**
 * Manages performance metrics collection and monitoring
 * @class PerformanceMonitor
 */
export class PerformanceMonitor {
  /**
   * Singleton instance of the performance monitor
   * @private
   */
  private static instance: PerformanceMonitor

  /**
   * Map of operations being monitored
   * @private
   */
  private operations: Map<string, Operation> = new Map()

  /**
   * Maximum number of data points to store for each metric
   * @private
   */
  private readonly maxDataPoints: number = 1000

  /**
   * Threshold for cleaning up old data points
   * @private
   */
  private readonly cleanupThreshold: number = 0.9 // 90% of maxDataPoints

  /**
   * Timestamp of the last cleanup
   * @private
   */
  private lastCleanup: number = Date.now()

  /**
   * Interval for cleaning up old data points
   * @private
   */
  private readonly cleanupInterval: number = 60000 // 1 minute

  /**
   * Map of metric values
   * @private
   */
  private metricValues: Map<MetricReport, number[]>

  /**
   * Memory threshold for warnings
   * @private
   */
  private memoryThreshold: number = 100 * 1024 * 1024 // 100MB default threshold

  /**
   * Lock for concurrent access
   * @private
   */
  private readonly lock = new Map<string, boolean>()

  /**
   * Private constructor for the performance monitor
   * @private
   */
  private constructor() {
    this.operations = new Map()
    this.maxDataPoints = 1000
    this.metricValues = new Map()
    this.initializeCleanupInterval()
  }

  /**
   * Gets the singleton instance of the performance monitor
   * @static
   * @returns {PerformanceMonitor} The singleton instance
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Initializes the cleanup interval
   * @private
   */
  private initializeCleanupInterval(): void {
    setInterval(() => this.cleanupOldData(), this.cleanupInterval)
  }

  /**
   * Cleans up old data points
   * @private
   */
  private cleanupOldData(): void {
    const now = Date.now()
    if (now - this.lastCleanup < this.cleanupInterval) return

    for (const [id, operation] of this.operations) {
      if (operation.metrics.latency.points && operation.metrics.latency.points.length > this.maxDataPoints * this.cleanupThreshold) {
        operation.metrics.latency.points = operation.metrics.latency.points.slice(-this.maxDataPoints)
      }
      if (operation.metrics.memoryUsage.points && operation.metrics.memoryUsage.points.length > this.maxDataPoints * this.cleanupThreshold) {
        operation.metrics.memoryUsage.points = operation.metrics.memoryUsage.points.slice(-this.maxDataPoints)
      }
      if (operation.metrics.requestSize.points && operation.metrics.requestSize.points.length > this.maxDataPoints * this.cleanupThreshold) {
        operation.metrics.requestSize.points = operation.metrics.requestSize.points.slice(-this.maxDataPoints)
      }
      if (operation.metrics.responseSize.points && operation.metrics.responseSize.points.length > this.maxDataPoints * this.cleanupThreshold) {
        operation.metrics.responseSize.points = operation.metrics.responseSize.points.slice(-this.maxDataPoints)
      }
    }

    this.lastCleanup = now
  }

  /**
   * Acquires a lock for concurrent access
   * @param {string} operationId - ID of the operation
   * @returns {boolean} Whether the lock was acquired
   * @private
   */
  private acquireLock(operationId: string): boolean {
    if (this.lock.get(operationId)) {
      return false
    }
    this.lock.set(operationId, true)
    return true
  }

  /**
   * Releases a lock for concurrent access
   * @param {string} operationId - ID of the operation
   * @private
   */
  private releaseLock(operationId: string): void {
    this.lock.delete(operationId)
  }

  /**
   * Starts a new operation
   * @param {string} id - ID of the operation
   * @returns {string} The ID of the operation
   */
  public startOperation(id: string): string {
    if (this.operations.has(id)) {
      throw new MetricsError(`Operation with id ${id} already exists`)
    }

    const operation: Operation = {
      id,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      warnings: [],
      metrics: {
        latency: {
          min: Infinity,
          max: -Infinity,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: []
        },
        memoryUsage: {
          min: Infinity,
          max: -Infinity,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: []
        },
        requestSize: {
          min: Infinity,
          max: -Infinity,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: []
        },
        responseSize: {
          min: Infinity,
          max: -Infinity,
          avg: 0,
          count: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          points: []
        }
      }
    }
    this.operations.set(id, operation)
    return id
  }

  /**
   * Records a warning for an operation
   * @param {string} operationId - ID of the operation
   * @param {string} message - Warning message
   */
  public recordWarning(operationId: string, message: string): void {
    const operation = this.getOperation(operationId)
    operation.warnings.push({ message, timestamp: performance.now() })
  }

  /**
   * Records latency for an operation
   * @param {string} id - ID of the operation
   * @param {number} value - Latency value
   */
  public recordLatency(id: string, value: number): void {
    if (!this.acquireLock(id)) {
      throw new MetricsError('Operation is locked by another process')
    }
    try {
      const operation = this.getOperation(id)
      this.updateMetric(operation.metrics.latency, value)
    } finally {
      this.releaseLock(id)
    }
  }

  /**
   * Records memory usage for an operation
   * @param {string} id - ID of the operation
   * @param {number} value - Memory usage value
   */
  public recordMemoryUsage(id: string, value: number): void {
    if (!this.acquireLock(id)) {
      throw new MetricsError('Operation is locked by another process')
    }
    try {
      const operation = this.getOperation(id)
      this.updateMetric(operation.metrics.memoryUsage, value)
      
      // Check memory threshold
      if (value > this.memoryThreshold) {
        this.recordWarning(id, `Memory usage exceeded threshold: ${value} bytes`)
      }
    } finally {
      this.releaseLock(id)
    }
  }

  /**
   * Records request size for an operation
   * @param {string} id - ID of the operation
   * @param {number} value - Request size value
   */
  public recordRequestSize(id: string, value: number): void {
    if (!this.acquireLock(id)) {
      throw new MetricsError('Operation is locked by another process')
    }
    try {
      const operation = this.getOperation(id)
      this.updateMetric(operation.metrics.requestSize, value)
    } finally {
      this.releaseLock(id)
    }
  }

  /**
   * Records response size for an operation
   * @param {string} id - ID of the operation
   * @param {number} value - Response size value
   */
  public recordResponseSize(id: string, value: number): void {
    if (!this.acquireLock(id)) {
      throw new MetricsError('Operation is locked by another process')
    }
    try {
      const operation = this.getOperation(id)
      this.updateMetric(operation.metrics.responseSize, value)
    } finally {
      this.releaseLock(id)
    }
  }

  /**
   * Updates a metric with a new value
   * @param {MetricReport & { points: MetricPoint[] }} metric - Metric to update
   * @param {number} value - New value for the metric
   * @private
   */
  private updateMetric(metric: MetricReport & { points: MetricPoint[] }, value: number): void {
    const point: MetricPoint = {
      timestamp: performance.now(),
      value
    }
    metric.points.push(point)
    
    // Keep only last maxDataPoints
    if (metric.points.length > this.maxDataPoints) {
      metric.points.shift()
    }

    metric.min = Math.min(metric.min, value)
    metric.max = Math.max(metric.max, value)
    metric.count++
    metric.avg = ((metric.avg * (metric.count - 1)) + value) / metric.count
    
    // Calculate percentiles from points
    if (metric.points.length > 0) {
      const sorted = metric.points.map(p => p.value).sort((a, b) => a - b)
      metric.p50 = this.calculatePercentile(sorted, 50)
      metric.p95 = this.calculatePercentile(sorted, 95)
      metric.p99 = this.calculatePercentile(sorted, 99)
    }
  }

  /**
   * Calculates a percentile from a sorted array of numbers
   * @param {number[]} sorted - Sorted array of numbers
   * @param {number} percentile - Percentile to calculate
   * @returns {number} The calculated percentile
   * @private
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index]
  }

  /**
   * Gets the metrics for an operation
   * @param {string} id - ID of the operation
   * @returns {Operation | undefined} The metrics for the operation
   */
  public getMetrics(id: string): Operation | undefined {
    return this.operations.get(id)
  }

  /**
   * Clears all operations and metrics
   */
  public clear(): void {
    this.operations.clear()
    this.metricValues.clear()
    this.lock.clear()
  }

  /**
   * Ends an operation and generates a report
   * @param {string} operationId - ID of the operation
   * @param {string} [source] - Source of the operation
   * @param {string[]} [tags] - Tags for the operation
   * @returns {PerformanceReport} The generated report
   */
  public endOperation(operationId: string, source?: string, tags?: string[]): PerformanceReport {
    if (!this.acquireLock(operationId)) {
      throw new MetricsError('Operation is locked by another process')
    }
    try {
      const operation = this.getOperation(operationId)
      const endTime = performance.now()
      operation.endTime = endTime;
      operation.duration = endTime - operation.startTime
      const report = generateReport(operation, operation.duration, source, tags)
      this.operations.delete(operationId)
      return report
    } finally {
      this.releaseLock(operationId)
    }
  }

  /**
   * Gets an operation by ID
   * @param {string} operationId - ID of the operation
   * @returns {Operation} The operation
   * @private
   */
  private getOperation(operationId: string): Operation {
    const operation = this.operations.get(operationId)
    if (!operation) {
      throw new MetricsError(`No operation found with id ${operationId}`)
    }
    return operation
  }
}

/**
 * Decorator for monitoring method performance
 * @param {any} target - Target object
 * @param {string} propertyKey - Method name
 * @param {PropertyDescriptor} descriptor - Method descriptor
 * @returns {PropertyDescriptor} The decorated method descriptor
 */
export function monitored(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const monitor = PerformanceMonitor.getInstance()
    const operationId = monitor.startOperation(propertyKey)

    try {
      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()
      
      // Execute the original method
      const result = await originalMethod.apply(this, args)
      
      // Record metrics
      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed
      
      monitor.recordLatency(operationId, endTime - startTime)
      monitor.recordMemoryUsage(operationId, endMemory - startMemory)
      
      if (result) {
        const requestSize = JSON.stringify(args).length
        const responseSize = JSON.stringify(result).length
        monitor.recordRequestSize(operationId, requestSize)
        monitor.recordResponseSize(operationId, responseSize)
      }

      // Generate and store report
      const report = monitor.endOperation(operationId)
      MetricStorage.getInstance().storeReport(report)

      return result
    } catch (error) {
      monitor.clear() // Clean up on error
      throw error
    }
  }

  return descriptor
}

export interface MetricData {
  avg: number;
  min: number;
  max: number;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  points: MetricPoint[];
}

export interface MetricsReport {
  latency: MetricData;
  memoryUsage: MetricData;
  requestSize: MetricData;
  responseSize: MetricData;
}

export class MetricsCollector {
  private storage: MetricStorage;
  private currentReport: MetricsReport | undefined;

  constructor() {
    this.storage = new MetricStorage();
    this.resetReport();
  }

  private resetReport(): void {
    this.currentReport = {
      latency: this.createEmptyMetricData(),
      memoryUsage: this.createEmptyMetricData(),
      requestSize: this.createEmptyMetricData(),
      responseSize: this.createEmptyMetricData()
    };
  }

  private createEmptyMetricData(): MetricData {
    return {
      avg: 0,
      min: Infinity,
      max: -Infinity,
      count: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      points: []
    };
  }

  public recordMetric(type: keyof MetricsReport, value: number): void {
    const metric = this.currentReport[type];
    const point: MetricPoint = {
      timestamp: Date.now(),
      value
    };

    metric.points.push(point);
    metric.count++;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.points.reduce((sum, p) => sum + p.value, 0) / metric.count;

    // Update percentiles
    const sortedValues = metric.points.map(p => p.value).sort((a, b) => a - b);
    metric.p50 = this.getPercentile(sortedValues, 50);
    metric.p95 = this.getPercentile(sortedValues, 95);
    metric.p99 = this.getPercentile(sortedValues, 99);
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[index];
  }

  public async saveReport(): Promise<void> {
    await this.storage.store(this.currentReport);
    this.resetReport();
  }

  public async getReports(options?: { startTime?: number; endTime?: number }): Promise<StoredReport[]> {
    return this.storage.query(options);
  }
}
