import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../src/metrics';

describe('PerformanceMonitor Stress Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.clear();
  });

  afterEach(() => {
    monitor.clear();
  });

  it('should handle high volume of concurrent operations', async () => {
    const CONCURRENT_OPERATIONS = 100;

    // Concurrent operation creation
    const concurrentOperations = Array.from({ length: CONCURRENT_OPERATIONS }, (_, i) => {
      return async () => {
        const operationId = monitor.startOperation(`stress-test-${i}`);
        
        // Simulate various metric recordings
        for (let j = 0; j < 10; j++) {
          monitor.recordLatency(operationId, Math.random() * 100);
          monitor.recordMemoryUsage(operationId, Math.random() * 1024 * 1024);
          monitor.recordRequestSize(operationId, Math.random() * 10000);
          monitor.recordResponseSize(operationId, Math.random() * 10000);
        }

        // Randomly add warnings
        if (Math.random() < 0.1) {
          monitor.recordWarning(operationId, `Random warning for operation ${operationId}`);
        }

        const report = monitor.endOperation(operationId);
        return report;
      };
    });

    // Execute concurrent operations
    console.time('concurrent-operations');
    const results = await Promise.all(concurrentOperations.map(op => op()));
    console.timeEnd('concurrent-operations');

    // Verify results
    expect(results.length).toBe(CONCURRENT_OPERATIONS);
    results.forEach(report => {
      expect(report.metrics.latency.count).toBe(10);
      expect(report.metrics.memoryUsage.count).toBe(10);
      expect(report.metrics.requestSize.count).toBe(10);
      expect(report.metrics.responseSize.count).toBe(10);
      expect(report.metrics.latency.points).toHaveLength(10);
      expect(report.metrics.memoryUsage.points).toHaveLength(10);
      expect(report.metrics.requestSize.points).toHaveLength(10);
      expect(report.metrics.responseSize.points).toHaveLength(10);
    });
  });

  it('should maintain performance with many data points', () => {
    const operationId = monitor.startOperation('max-data-points-test');
    const maxPoints = 1000; // Default max points
    
    // Record data points up to maxDataPoints limit
    console.time('data-points-recording');
    for (let i = 0; i < maxPoints + 100; i++) {
      monitor.recordLatency(operationId, Math.random() * 100);
    }
    console.timeEnd('data-points-recording');

    const operation = monitor.getMetrics(operationId);
    const report = monitor.endOperation(operationId);

    // Verify performance metrics
    expect(operation?.metrics.latency.points.length).toBeLessThanOrEqual(maxPoints);
    expect(report.metrics.latency.count).toBe(maxPoints + 100);
    expect(report.metrics.latency.points.length).toBeLessThanOrEqual(maxPoints);
  });

  it('should handle rapid warning generation', () => {
    const operationId = monitor.startOperation('warning-stress-test');
    const WARNING_COUNT = 1000;

    // Generate many warnings quickly
    console.time('warning-generation');
    for (let i = 0; i < WARNING_COUNT; i++) {
      monitor.recordWarning(operationId, `Warning ${i}`);
    }
    console.timeEnd('warning-generation');

    const operation = monitor.getMetrics(operationId);
    expect(operation?.warnings).toHaveLength(WARNING_COUNT);
  });

  it('should handle extreme metric values', () => {
    const operationId = monitor.startOperation('extreme-values-test');
    const EXTREME_VALUES = [
      1000000, // Large but finite number
      -1000000, // Large negative but finite number
      0.0001, // Small but non-zero number
      100, // Normal number
      1, // Unit value
      -1 // Negative unit value
    ];

    // Record extreme values for each metric type
    EXTREME_VALUES.forEach(value => {
      monitor.recordLatency(operationId, Math.abs(value)); // Latency should be positive
      monitor.recordMemoryUsage(operationId, Math.abs(value)); // Memory should be positive
      monitor.recordRequestSize(operationId, Math.abs(value)); // Size should be positive
      monitor.recordResponseSize(operationId, Math.abs(value)); // Size should be positive
    });

    const report = monitor.endOperation(operationId);
    
    // Verify statistics are calculated correctly
    const metrics = report.metrics;
    expect(metrics.latency.min).toBeGreaterThanOrEqual(0.0001);
    expect(metrics.latency.max).toBe(1000000);
    expect(metrics.latency.count).toBe(EXTREME_VALUES.length);
    expect(metrics.latency.points).toHaveLength(EXTREME_VALUES.length);
  });

  it('should handle memory pressure', async () => {
    const OPERATIONS = 100;
    const METRICS_PER_OPERATION = 1000;
    const operations: string[] = [];

    // Start multiple operations
    console.time('memory-pressure-test');
    for (let i = 0; i < OPERATIONS; i++) {
      const operationId = monitor.startOperation(`memory-test-${i}`);
      operations.push(operationId);

      // Record many metrics for each operation
      for (let j = 0; j < METRICS_PER_OPERATION; j++) {
        monitor.recordLatency(operationId, Math.random() * 100);
        monitor.recordMemoryUsage(operationId, Math.random() * 1024 * 1024);
        monitor.recordRequestSize(operationId, Math.random() * 10000);
        monitor.recordResponseSize(operationId, Math.random() * 10000);

        // Add occasional warnings
        if (j % 100 === 0) {
          monitor.recordWarning(operationId, `Warning at ${j} metrics`);
        }
      }
    }

    // End all operations and collect reports
    const reports = operations.map(id => monitor.endOperation(id));
    console.timeEnd('memory-pressure-test');

    // Verify all operations completed successfully
    expect(reports.length).toBe(OPERATIONS);
    reports.forEach(report => {
      expect(report.metrics.latency.count).toBe(METRICS_PER_OPERATION);
      expect(report.metrics.memoryUsage.count).toBe(METRICS_PER_OPERATION);
      expect(report.metrics.requestSize.count).toBe(METRICS_PER_OPERATION);
      expect(report.metrics.responseSize.count).toBe(METRICS_PER_OPERATION);
      expect(report.metrics.latency.points.length).toBeLessThanOrEqual(1000);
      expect(report.metrics.memoryUsage.points.length).toBeLessThanOrEqual(1000);
      expect(report.metrics.requestSize.points.length).toBeLessThanOrEqual(1000);
      expect(report.metrics.responseSize.points.length).toBeLessThanOrEqual(1000);
    });
  });
});
