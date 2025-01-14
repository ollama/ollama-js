import { PerformanceReport } from './reporting'
import { ValidationError } from './errors'
import { MetricPoint, StoredReport } from './types'

/**
 * Options for configuring metric storage
 */
export interface StorageOptions {
  maxEntries?: number;
  retentionDays?: number;
}

/**
 * Options for querying stored metrics
 */
export interface QueryOptions {
  source?: string;
  tags?: string[];
  startTime?: number;
  endTime?: number;
}

export class MetricStorage {
  [x: string]: any;
  private static instance: MetricStorage | null = null;

  static getInstance(options: StorageOptions = {}): MetricStorage {
    if (!MetricStorage.instance) {
      MetricStorage.instance = new MetricStorage(options);
    }
    return MetricStorage.instance;
  }

  private readonly storageKey = 'ollama_metrics'

  private constructor(private options: StorageOptions = {}) {}

  /**
   * Store a performance report
   * @param report Performance report to store
   * @param source Optional source identifier
   * @param tags Optional tags
   * @throws {ValidationError} If report is invalid
   */
  public async store(report: PerformanceReport, source?: string, tags?: string[]): Promise<void> {
    if (!this.validateReport(report)) {
      throw new ValidationError('Invalid report format', { report })
    }

    const storedReport: StoredReport = {
      id: crypto.randomUUID(),
      data: report,
      createdAt: Date.now(),
      storedAt: Date.now(),
      source,
      tags
    }

    try {
      const reports = await this.loadReports()
      reports.push(storedReport)
      localStorage.setItem(this.storageKey, JSON.stringify(reports))
    } catch (err) {
      const error = err as Error
      throw new Error(`Failed to store report: ${error.message}`)
    }
  }

  /**
   * Query stored reports
   * @param options Query options
   * @returns Matching reports
   */
  public async query(options: QueryOptions = {}): Promise<StoredReport[]> {
    try {
      const reports = await this.loadReports()
      return reports.filter(report => {
        if (options.source && report.source !== options.source) return false
        if (options.tags && !this.hasMatchingTags(report.tags || [], options.tags)) return false
        if (options.startTime && report.storedAt < options.startTime) return false
        if (options.endTime && report.storedAt > options.endTime) return false
        return true
      })
    } catch (err) {
      const error = err as Error
      throw new Error(`Failed to query reports: ${error.message}`)
    }
  }

  /**
   * Clear all stored reports
   */
  public async clear(): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([]))
    } catch (err) {
      const error = err as Error
      throw new Error(`Failed to clear reports: ${error.message}`)
    }
  }

  private validateReport(report: PerformanceReport): boolean {
    return (
      report &&
      typeof report === 'object' &&
      'metrics' in report &&
      typeof report.metrics === 'object'
    )
  }

  private hasMatchingTags(reportTags: string[], queryTags: string[]): boolean {
    return queryTags.every(tag => reportTags.includes(tag))
  }

  private async loadReports(): Promise<StoredReport[]> {
    const data = localStorage.getItem(this.storageKey)
    if (!data) return []

    try {
      return JSON.parse(data)
    } catch (err) {
      const error = err as Error
      throw new Error(`Failed to parse stored reports: ${error.message}`)
    }
  }

  /**
   * Clean up old reports
   * @param olderThan Optional timestamp to remove reports older than
   */
  public async cleanup(olderThan?: number): Promise<void> {
    try {
      const reports = await this.loadReports()
      const threshold = olderThan || Date.now() - (7 * 24 * 60 * 60 * 1000) // Default 7 days
      const filtered = reports.filter(report => report.storedAt >= threshold)
      localStorage.setItem(this.storageKey, JSON.stringify(filtered))
    } catch (err) {
      const error = err as Error
      throw new Error(`Failed to cleanup reports: ${error.message}`)
    }
  }
}
