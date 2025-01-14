import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, MetricName, MetricsError } from '../src/metrics';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    monitor = PerformanceMonitor.getInstance();
    monitor.clear();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should be a singleton', () => {
      const monitor2 = PerformanceMonitor.getInstance();
      expect(monitor).toBe(monitor2);
    });

    it('should maintain state across instances', () => {
      const operationId = monitor.startOperation('test-operation');
      monitor.recordLatency(operationId, 100);
      
      const monitor2 = PerformanceMonitor.getInstance();
      const metrics = monitor2.getMetrics(operationId);
      expect(metrics?.metrics.latency.points[0]).toBe(100);
    });
  });

  describe('Basic Operation Management', () => {
    it('should track operation metrics', async () => {
      const operationId = monitor.startOperation('test-operation');
      expect(operationId).toBe('test-operation');

      monitor.recordLatency(operationId, 100);
      monitor.recordMemoryUsage(operationId, 1024);
      monitor.recordRequestSize(operationId, 512);
      monitor.recordResponseSize(operationId, 1024);

      const operation = monitor.getMetrics(operationId);
      expect(operation).toBeDefined();
      expect(operation?.metrics.latency.points).toHaveLength(1);
      expect(operation?.metrics.memoryUsage.points).toHaveLength(1);
      expect(operation?.metrics.requestSize.points).toHaveLength(1);
      expect(operation?.metrics.responseSize.points).toHaveLength(1);

      const report = monitor.endOperation(operationId);
      expect(report.metrics.latency.avg).toBe(100);
      expect(report.metrics.memoryUsage.avg).toBe(1024);
      expect(report.metrics.requestSize.avg).toBe(512);
      expect(report.metrics.responseSize.avg).toBe(1024);
    });

    it('should prevent duplicate operation IDs', () => {
      const operationId = 'test-operation';
      monitor.startOperation(operationId);

      expect(() => {
        monitor.startOperation(operationId);
      }).toThrow(MetricsError);
    });

    it('should handle operation cleanup', () => {
      const operationId = monitor.startOperation('test-operation');
      monitor.recordLatency(operationId, 100);
      monitor.endOperation(operationId);

      expect(() => {
        monitor.recordLatency(operationId, 200);
      }).toThrow(MetricsError);
    });
  });

  describe('Data Point Management', () => {
    it('should maintain max data points limit', () => {
      const operationId = monitor.startOperation('test-operation');
      const limit = 1000; // Default limit

      for (let i = 0; i < limit + 10; i++) {
        monitor.recordLatency(operationId, i);
      }

      const operation = monitor.getMetrics(operationId);
      expect(operation?.metrics.latency.points).toHaveLength(limit);
      expect(operation?.metrics.latency.count).toBe(limit + 10);
      
      // Verify we keep the most recent points
      const points = operation?.metrics.latency.points || [];
      expect(points[points.length - 1]).toBe(limit + 9);
    });

    it('should handle negative values', () => {
      const operationId = monitor.startOperation('test-operation');
      
      expect(() => {
        monitor.recordLatency(operationId, -100);
      }).toThrow(MetricsError);
      
      expect(() => {
        monitor.recordMemoryUsage(operationId, -1024);
      }).toThrow(MetricsError);
    });

    it('should handle extremely large values', () => {
      const operationId = monitor.startOperation('test-operation');
      const largeValue = Number.MAX_SAFE_INTEGER;
      
      monitor.recordLatency(operationId, largeValue);
      const metrics = monitor.getMetrics(operationId);
      expect(metrics?.metrics.latency.max).toBe(largeValue);
    });

    it('should handle floating point values', () => {
      const operationId = monitor.startOperation('test-operation');
      const values = [1.5, 2.7, 3.14159, 4.0];
      
      values.forEach(value => {
        monitor.recordLatency(operationId, value);
      });
      
      const metrics = monitor.getMetrics(operationId);
      expect(metrics?.metrics.latency.avg).toBeCloseTo(2.84, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation IDs', () => {
      expect(() => {
        monitor.recordLatency('non-existent', 100);
      }).toThrow(MetricsError);
      
      expect(() => {
        monitor.getMetrics('non-existent');
      }).toThrow(MetricsError);
      
      expect(() => {
        monitor.endOperation('non-existent');
      }).toThrow(MetricsError);
    });

    it('should handle null and undefined values', () => {
      const operationId = monitor.startOperation('test-operation');
      
      expect(() => {
        monitor.recordLatency(operationId, null as any);
      }).toThrow(MetricsError);
      
      expect(() => {
        monitor.recordLatency(operationId, undefined as any);
      }).toThrow(MetricsError);
    });

    it('should handle NaN and Infinity values', () => {
      const operationId = monitor.startOperation('test-operation');
      
      expect(() => {
        monitor.recordLatency(operationId, NaN);
      }).toThrow(MetricsError);
      
      expect(() => {
        monitor.recordLatency(operationId, Infinity);
      }).toThrow(MetricsError);
    });
  });

  describe('Warning System', () => {
    it('should handle warnings', () => {
      const operationId = monitor.startOperation('test-operation');
      const warningMessage = 'Test warning';
      
      monitor.recordWarning(operationId, warningMessage);
      const operation = monitor.getMetrics(operationId);
      
      expect(operation?.warnings).toHaveLength(1);
      expect(operation?.warnings[0]).toBe(warningMessage);
    });

    it('should handle memory threshold warnings', () => {
      const operationId = monitor.startOperation('test-operation');
      const threshold = 1024 * 1024 * 100; // 100MB default threshold
      
      monitor.recordMemoryUsage(operationId, threshold + 1);
      const operation = monitor.getMetrics(operationId);
      
      expect(operation?.warnings).toHaveLength(1);
      expect(operation?.warnings[0]).toContain('Memory usage exceeded threshold');
    });

    it('should handle multiple warnings', () => {
      const operationId = monitor.startOperation('test-operation');
      const warnings = ['Warning 1', 'Warning 2', 'Warning 3'];
      
      warnings.forEach(warning => {
        monitor.recordWarning(operationId, warning);
      });
      
      const operation = monitor.getMetrics(operationId);
      expect(operation?.warnings).toHaveLength(warnings.length);
      warnings.forEach((warning, index) => {
        expect(operation?.warnings[index]).toBe(warning);
      });
    });
  });

  describe('Statistical Calculations', () => {
    it('should calculate statistics correctly', () => {
      const operationId = monitor.startOperation('test-operation');
      const values = [100, 200, 300, 400, 500];
      
      values.forEach(value => {
        monitor.recordLatency(operationId, value);
      });

      const operation = monitor.getMetrics(operationId);
      expect(operation).toBeDefined();
      
      const stats = operation!.metrics.latency;
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(500);
      expect(stats.avg).toBe(300);
      expect(stats.count).toBe(5);
      expect(stats.p50).toBe(300);
      expect(stats.p95).toBe(500);
      expect(stats.p99).toBe(500);
    });

    it('should handle single data point statistics', () => {
      const operationId = monitor.startOperation('test-operation');
      monitor.recordLatency(operationId, 100);
      
      const stats = monitor.getMetrics(operationId)!.metrics.latency;
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(100);
      expect(stats.avg).toBe(100);
      expect(stats.p50).toBe(100);
      expect(stats.p95).toBe(100);
      expect(stats.p99).toBe(100);
    });

    it('should calculate percentiles correctly for various distributions', () => {
      const operationId = monitor.startOperation('test-operation');
      // Create a skewed distribution
      const values = Array.from({ length: 100 }, (_, i) => i < 90 ? i : i * 10);
      
      values.forEach(value => {
        monitor.recordLatency(operationId, value);
      });
      
      const stats = monitor.getMetrics(operationId)!.metrics.latency;
      expect(stats.p50).toBeLessThan(stats.p95);
      expect(stats.p95).toBeLessThan(stats.p99);
      expect(stats.p99).toBeLessThan(stats.max);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations', async () => {
      const op1 = monitor.startOperation('op1');
      const op2 = monitor.startOperation('op2');

      monitor.recordLatency(op1, 100);
      monitor.recordLatency(op2, 200);

      const metrics1 = monitor.getMetrics(op1);
      const metrics2 = monitor.getMetrics(op2);

      expect(metrics1?.metrics.latency.points).toHaveLength(1);
      expect(metrics2?.metrics.latency.points).toHaveLength(1);
      expect(metrics1?.metrics.latency.avg).toBe(100);
      expect(metrics2?.metrics.latency.avg).toBe(200);
    });

    it('should handle rapid concurrent operations', async () => {
      const operations = 100;
      const promises = Array.from({ length: operations }, async (_, i) => {
        const opId = monitor.startOperation(`op-${i}`);
        monitor.recordLatency(opId, i);
        return monitor.endOperation(opId);
      });
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(operations);
      results.forEach((result, i) => {
        expect(result.metrics.latency.avg).toBe(i);
      });
    });

    it('should handle interleaved metric recordings', async () => {
      const op1 = monitor.startOperation('op1');
      const op2 = monitor.startOperation('op2');
      
      // Interleave recordings between operations
      monitor.recordLatency(op1, 100);
      monitor.recordLatency(op2, 200);
      monitor.recordMemoryUsage(op1, 1024);
      monitor.recordMemoryUsage(op2, 2048);
      
      const report1 = monitor.endOperation(op1);
      const report2 = monitor.endOperation(op2);
      
      expect(report1.metrics.latency.avg).toBe(100);
      expect(report2.metrics.latency.avg).toBe(200);
      expect(report1.metrics.memoryUsage.avg).toBe(1024);
      expect(report2.metrics.memoryUsage.avg).toBe(2048);
    });
  });
});