import { MetricReport, PerformanceReport } from './reporting'
import { formatMetricValue } from './reporting'

export interface ChartOptions {
  xLabel(xLabel: any): unknown
  yLabel(yLabel: any): unknown
  width?: number
  height?: number
  padding?: number
  title?: string
  showLegend?: boolean
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color?: string
  }[]
}

/**
 * Generates ASCII charts for performance metrics
 */
export class ChartGenerator {
  private static readonly DEFAULT_WIDTH = 80
  private static readonly DEFAULT_HEIGHT = 20
  private static readonly DEFAULT_PADDING = 2
  private static readonly AXIS_LABEL_WIDTH = 8

  /**
   * Generate a time series chart from performance reports
   * @param reports Array of performance reports to visualize
   * @param metricKey Metric to visualize (e.g., 'latency', 'memoryUsage')
   * @param options Chart options
   */
  public static generateTimeSeriesChart(
    reports: PerformanceReport[],
    metricKey: keyof PerformanceReport['metrics'],
    options: ChartOptions = {}
  ): string {
    if (!reports || reports.length === 0) {
      return 'No data available for visualization'
    }

    const {
      width = this.DEFAULT_WIDTH,
      height = this.DEFAULT_HEIGHT,
      padding = this.DEFAULT_PADDING,
      title = `${this.formatAxisLabel(metricKey)} Over Time`,
      showLegend = true
    } = options

    const data = reports.map(report => ({
      timestamp: report.startTime,
      value: report.metrics[metricKey].avg
    }))

    return this.generateChart(data, title, { ...options, type: 'line' })
  }

  /**
   * Generate a distribution chart (histogram) from performance reports
   * @param reports Array of stored reports to visualize
   * @param metricKey Metric to analyze
   * @param options Chart options
   */
  public static generateDistributionChart(
    reports: PerformanceReport[],
    metricKey: keyof PerformanceReport['metrics'],
    options: ChartOptions = {}
  ): string {
    if (!reports || reports.length === 0) {
      return 'No data available for visualization'
    }

    const {
      width = this.DEFAULT_WIDTH,
      height = this.DEFAULT_HEIGHT,
      padding = this.DEFAULT_PADDING,
      title = `${this.formatAxisLabel(metricKey)} Distribution`,
      showLegend = true
    } = options

    // Create histogram data
    const values = reports.map(r => r.metrics[metricKey].avg)
    const bins = this.createHistogramBins(values, 10)
    const data = bins.map((count, i) => ({
      timestamp: i,
      value: count
    }))

    return this.generateChart(data, title, { ...options, type: 'bar' })
  }

  private static createHistogramBins(values: number[], numBins: number): number[] {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const binSize = range / numBins
    const bins = new Array(numBins).fill(0)

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), numBins - 1)
      bins[binIndex]++
    })

    return bins
  }

  private static generateChart(
    data: { timestamp: number; value: number }[],
    title: string,
    options: ChartOptions & { type: 'line' | 'bar' }
  ): string {
    const { width = this.DEFAULT_WIDTH, height = this.DEFAULT_HEIGHT, type } = options
    
    if (data.length === 0) {
      return 'No data available for visualization'
    }

    // Sort data by timestamp
    data.sort((a, b) => a.timestamp - b.timestamp)

    // Calculate value range
    const values = data.map(d => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue || 1 // Prevent division by zero

    // Create chart grid
    const chartArea = Array(height)
      .fill(null)
      .map(() => Array(width).fill(' '))

    // Draw axes and labels
    this.drawAxes(chartArea, minValue, maxValue)

    // Plot data points
    const plotWidth = width - this.AXIS_LABEL_WIDTH
    const plotHeight = height - 2 // Account for title and bottom axis

    if (type === 'line') {
      this.drawLine(chartArea, data, plotWidth, plotHeight, minValue, valueRange)
    } else {
      this.drawBars(chartArea, data, plotWidth, plotHeight, minValue, valueRange)
    }

    // Add title
    const titleStart = Math.floor((width - title.length) / 2)
    title.split('').forEach((char, i) => {
      if (titleStart + i < width) {
        chartArea[0][titleStart + i] = char
      }
    })

    return chartArea.map(row => row.join('')).join('\n')
  }

  private static drawAxes(
    chartArea: string[][],
    minValue: number,
    maxValue: number
  ): void {
    const height = chartArea.length
    const width = chartArea[0].length

    // Draw y-axis
    for (let i = 0; i < height; i++) {
      chartArea[i][this.AXIS_LABEL_WIDTH] = '│'
    }

    // Draw x-axis
    for (let i = this.AXIS_LABEL_WIDTH; i < width; i++) {
      chartArea[height - 2][i] = '─'
    }

    // Draw corner
    chartArea[height - 2][this.AXIS_LABEL_WIDTH] = '└'

    // Add value labels with proper formatting
    const formatValue = (v: number) => v.toFixed(1).padStart(6)
    const labels = [
      formatValue(maxValue),
      formatValue((maxValue + minValue) / 2),
      formatValue(minValue)
    ]

    const labelPositions = [1, Math.floor(height / 2), height - 3]
    labels.forEach((label, i) => {
      label.split('').forEach((char, j) => {
        if (j < this.AXIS_LABEL_WIDTH) {
          chartArea[labelPositions[i]][j] = char
        }
      })
    })
  }

  private static drawLine(
    chartArea: string[][],
    data: { timestamp: number; value: number }[],
    plotWidth: number,
    plotHeight: number,
    minValue: number,
    valueRange: number
  ): void {
    for (let i = 1; i < data.length; i++) {
      const x1 = Math.floor(((i - 1) / (data.length - 1)) * plotWidth) + this.AXIS_LABEL_WIDTH
      const x2 = Math.floor((i / (data.length - 1)) * plotWidth) + this.AXIS_LABEL_WIDTH
      const y1 = Math.floor(((data[i - 1].value - minValue) / valueRange) * plotHeight)
      const y2 = Math.floor(((data[i].value - minValue) / valueRange) * plotHeight)

      // Draw line segment using Bresenham's algorithm
      this.drawLineSegment(chartArea, x1, y1, x2, y2)
    }
  }

  private static drawLineSegment(
    chartArea: string[][],
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy
    let x = x1
    let y = y1

    while (true) {
      if (x >= 0 && x < chartArea[0].length && y >= 0 && y < chartArea.length - 2) {
        chartArea[chartArea.length - 3 - y][x] = '•'
      }

      if (x === x2 && y === y2) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }
  }

  private static drawBars(
    chartArea: string[][],
    data: { timestamp: number; value: number }[],
    plotWidth: number,
    plotHeight: number,
    minValue: number,
    valueRange: number
  ): void {
    const barWidth = Math.max(1, Math.floor(plotWidth / data.length))

    data.forEach((point, i) => {
      const x = Math.floor((i / data.length) * plotWidth) + this.AXIS_LABEL_WIDTH
      const barHeight = Math.floor(((point.value - minValue) / valueRange) * plotHeight)

      for (let y = 0; y < barHeight; y++) {
        for (let dx = 0; dx < barWidth && x + dx < chartArea[0].length; dx++) {
          if (chartArea.length - 3 - y >= 0) {
            chartArea[chartArea.length - 3 - y][x + dx] = '█'
          }
        }
      }
    })
  }

  private static formatAxisLabel(value: string | number | symbol): string {
    const str = String(value)
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
