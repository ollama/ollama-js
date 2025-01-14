export interface AbortableAsyncIterator<T> extends AsyncIterator<T> {
  next: (value?: any) => Promise<IteratorResult<T>>;
  return?: (value?: any) => Promise<IteratorResult<T>>;
  throw?: (e?: any) => Promise<IteratorResult<T>>;
  abort?: () => void;
}

export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface StoredReport {
  id: string;
  data: any;
  createdAt: number;
  source?: string;
  tags?: string[];
  storedAt: number;
}

export interface StreamableRequest<T> {
  stream?: boolean;
  abortSignal?: AbortSignal;
  onProgress?: (response: T) => void;
}
