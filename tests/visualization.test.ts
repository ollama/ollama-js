import { describe, expect, it } from 'vitest';
import { ChartGenerator, ChartOptions } from '../src/visualization';
import { MetricReport, PerformanceReport, MetricPoint } from '../src/reporting';

describe('ChartGenerator', () => {
  const currentTime = Date.now();
  
  const testReport: PerformanceReport = {
    operationId: 'test-op',
    duration: 1000,
    source: undefined,
    tags: undefined,
    metrics: {
      latency: {
        avg: 100,
        min: 50,
        max: 150,
        count: 10,
        p50: 100,
        p95: 145,
        p99: 149,
        points: [
          { timestamp: 1, value: 50 },
          { timestamp: 2, value: 75 },
          { timestamp: 3, value: 100 },
          { timestamp: 4, value: 125 },
          { timestamp: 5, value: 150 },
          { timestamp: 6, value: 100 },
          { timestamp: 7, value: 75 },
          { timestamp: 8, value: 125 },
          { timestamp: 9, value: 100 },
          { timestamp: 10, value: 150 }
        ]
      },
      memoryUsage: {
        avg: 1024,
        min: 512,
        max: 2048,
        count: 10,
        p50: 1024,
        p95: 1900,
        p99: 2000,
        points: [
          { timestamp: 1, value: 512 },
          { timestamp: 2, value: 768 },
          { timestamp: 3, value: 1024 },
          { timestamp: 4, value: 1536 },
          { timestamp: 5, value: 2048 },
          { timestamp: 6, value: 1024 },
          { timestamp: 7, value: 768 },
          { timestamp: 8, value: 1536 },
          { timestamp: 9, value: 1024 },
          { timestamp: 10, value: 2048 }
        ]
      },
      requestSize: {
        avg: 512,
        min: 256,
        max: 1024,
        count: 10,
        p50: 512,
        p95: 900,
        p99: 1000,
        points: [
          { timestamp: 1, value: 256 },
          { timestamp: 2, value: 384 },
          { timestamp: 3, value: 512 },
          { timestamp: 4, value: 768 },
          { timestamp: 5, value: 1024 },
          { timestamp: 6, value: 512 },
          { timestamp: 7, value: 384 },
          { timestamp: 8, value: 768 },
          { timestamp: 9, value: 512 },
          { timestamp: 10, value: 1024 }
        ]
      },
      responseSize: {
        avg: 1024,
        min: 512,
        max: 2048,
        count: 10,
        p50: 1024,
        p95: 1900,
        p99: 2000,
        points: [
          { timestamp: 1, value: 512 },
          { timestamp: 2, value: 768 },
          { timestamp: 3, value: 1024 },
          { timestamp: 4, value: 1536 },
          { timestamp: 5, value: 2048 },
          { timestamp: 6, value: 1024 },
          { timestamp: 7, value: 768 },
          { timestamp: 8, value: 1536 },
          { timestamp: 9, value: 1024 },
          { timestamp: 10, value: 2048 }
        ]
      }
    },
    startTime: 0,
    endTime: 0,
    warnings: []
  };

  const emptyReport: PerformanceReport = {
    operationId: 'empty-op',
    duration: 0,
    source: undefined,
    tags: undefined,
    metrics: {
      latency: {
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        points: []
      },
      memoryUsage: {
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        points: []
      },
      requestSize: {
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        points: []
      },
      responseSize: {
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        points: []
      }
    },
    startTime: 0,
    endTime: 0,
    warnings: []
  };

  describe('Time Series Chart', () => {
    it('should generate time series chart with default options', () => {
      const chart = ChartGenerator.generateTimeSeriesChart([testReport], 'latency');
      expect(chart).toBeDefined();
      expect(typeof chart).toBe('string');
      expect(chart.length).toBeGreaterThan(0);
      expect(chart).toContain('│'); // Should contain y-axis
      expect(chart).toContain('─'); // Should contain x-axis
    });

    it('should generate time series chart with custom options', () => {
      const options: ChartOptions = {
        width: 40,
        height: 10,
        title: 'Latency Over Time',
        xLabel: function (xLabel: any): unknown {
          throw new Error('Function not implemented.');
        },
        yLabel: function (yLabel: any): unknown {
          throw new Error('Function not implemented.');
        }
      };

      const chart = ChartGenerator.generateTimeSeriesChart([testReport], 'latency', options);
      expect(chart).toBeDefined();
      expect(chart).toContain(options.title);
      expect(chart.split('\n').length).toBeLessThanOrEqual(options.height + 5); // Account for title and axes
    });

    it('should handle empty data gracefully', () => {
      const chart = ChartGenerator.generateTimeSeriesChart([emptyReport], 'latency');
      expect(chart).toBeDefined();
      expect(chart).toContain('No data');
    });

    it('should handle multiple reports', () => {
      const chart = ChartGenerator.generateTimeSeriesChart([testReport, testReport], 'latency');
      expect(chart).toBeDefined();
      expect(chart.length).toBeGreaterThan(0);
    });
  });

  describe('Distribution Chart', () => {
    it('should generate distribution chart with default options', () => {
      const chart = ChartGenerator.generateDistributionChart([testReport], 'memoryUsage');
      expect(chart).toBeDefined();
      expect(typeof chart).toBe('string');
      expect(chart.length).toBeGreaterThan(0);
      expect(chart).toContain('│'); // Should contain y-axis
      expect(chart).toContain('─'); // Should contain x-axis
    });

    it('should generate distribution chart with custom options', () => {
      const options: ChartOptions = {
        width: 40,
        height: 10,
        title: 'Memory Usage Distribution',
        xLabel: function (xLabel: any): unknown {
          throw new Error('Function not implemented.');
        },
        yLabel: function (yLabel: any): unknown {
          throw new Error('Function not implemented.');
        }
      };

      const chart = ChartGenerator.generateDistributionChart([testReport], 'memoryUsage', options);
      expect(chart).toBeDefined();
      expect(chart).toContain(options.title);
      expect(chart.split('\n').length).toBeLessThanOrEqual(options.height + 5); // Account for title and axes
    });

    it('should handle empty data gracefully', () => {
      const chart = ChartGenerator.generateDistributionChart([emptyReport], 'memoryUsage');
      expect(chart).toBeDefined();
      expect(chart).toContain('No data');
    });

    it('should handle multiple reports', () => {
      const chart = ChartGenerator.generateDistributionChart([testReport, testReport], 'memoryUsage');
      expect(chart).toBeDefined();
      expect(chart.length).toBeGreaterThan(0);
    });
  });

  describe('Chart Options', () => {
    it('should respect minimum dimensions', () => {
      const options: ChartOptions = {
        width: 1,
        height: 1,
        xLabel: function (xLabel: any): unknown {
          throw new Error('Function not implemented.');
        },
        yLabel: function (yLabel: any): unknown {
          throw new Error('Function not implemented.');
        }
      };

      const timeSeriesChart = ChartGenerator.generateTimeSeriesChart([testReport], 'latency', options);
      const distributionChart = ChartGenerator.generateDistributionChart([testReport], 'memoryUsage', options);

      expect(timeSeriesChart.split('\n').length).toBeGreaterThan(1);
      expect(distributionChart.split('\n').length).toBeGreaterThan(1);
    });

    it('should handle large dimensions', () => {
      const options: ChartOptions = {
        width: 200,
        height: 50,
        xLabel: function (xLabel: any): unknown {
          throw new Error('Function not implemented.');
        },
        yLabel: function (yLabel: any): unknown {
          throw new Error('Function not implemented.');
        }
      };

      const timeSeriesChart = ChartGenerator.generateTimeSeriesChart([testReport], 'latency', options);
      const distributionChart = ChartGenerator.generateDistributionChart([testReport], 'memoryUsage', options);

      expect(timeSeriesChart).toBeDefined();
      expect(distributionChart).toBeDefined();
    });

    it('should handle custom titles and labels', () => {
      const options: ChartOptions = {
        width: 40,
        height: 10,
        title: 'Custom Title',
        xLabel: 'X Axis',
        yLabel: 'Y Axis'
      };

      const chart = ChartGenerator.generateTimeSeriesChart([testReport], 'latency', options);
      expect(chart).toContain(options.title);
      expect(chart).toContain(options.xLabel);
      expect(chart).toContain(options.yLabel);
    });
  });
});
