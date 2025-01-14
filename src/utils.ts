import { version } from './version.js'
<<<<<<< HEAD
import type { ErrorResponse, Fetch } from './interfaces.js'
=======
import type { ErrorResponse, Fetch, ResponseType } from './interfaces.js'
import { PerformanceMonitor } from './metrics'
import { BaseError, ErrorType, ParseError, ResponseError, ValidationError, MemoryError } from './errors'

// HTTP Status Codes
export enum HttpStatus {
  OK = 200,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  TooManyRequests = 429,
  InternalServerError = 500,
  ServiceUnavailable = 503,
}

// Error Types
export enum ErrorType {
  PARSE = 'PARSE',
  VALIDATION = 'VALIDATION',
  RESPONSE = 'RESPONSE',
  UNKNOWN = 'UNKNOWN',
  Network = 'NetworkError',
  Timeout = 'TimeoutError',
  Memory = 'MemoryError',
}

interface ErrorDetails {
  message: string
  code?: string
  details?: unknown
}

/**
 * Base error class for all custom errors
 * @extends Error
 */
export class BaseError extends Error {
  type: ErrorType;

  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN) {
    super(message);
    this.type = type;
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

/**
 * An error class for response errors.
 * @extends Error
 */
<<<<<<< HEAD
class ResponseError extends Error {
  constructor(
    public error: string,
    public status_code: number,
  ) {
    super(error)
    this.name = 'ResponseError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResponseError)
=======
export class ResponseError extends BaseError {
  constructor(message: string) {
    super(message, ErrorType.RESPONSE);
  }
}

/**
 * An error class for parsing errors.
 * @extends BaseError
 */
export class ParseError extends BaseError {
  constructor(message: string) {
    super(message, ErrorType.PARSE);
  }
}

/**
 * An error class for validation errors.
 * @extends BaseError
 */
export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, ErrorType.VALIDATION);
  }
}

/**
 * An error class for memory errors.
 * @extends BaseError
 */
export class MemoryError extends BaseError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, ErrorType.Memory);
    if (details) {
      this.message += `: ${JSON.stringify(details)}`;
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
    }
  }
}

/**
 * An AsyncIterator which can be aborted
 */
export class AbortableAsyncIterator<T extends object> {
  private readonly abortController: AbortController
  private readonly itr: AsyncGenerator<T | ErrorResponse>
  private readonly doneCallback: () => void
<<<<<<< HEAD
=======
  private aborted: boolean = false
  private done: boolean = false
  private readonly bufferSize: number = 1024 * 1024 // 1MB buffer
  private readonly memoryUsage: { current: number } = { current: 0 }
  private readonly maxMemoryUsage: number = 1024 * 1024 * 100 // 100MB limit
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

  constructor(abortController: AbortController, itr: AsyncGenerator<T | ErrorResponse>, doneCallback: () => void) {
    this.abortController = abortController
    this.itr = itr
    this.doneCallback = doneCallback
  }

<<<<<<< HEAD
  abort() {
    this.abortController.abort()
=======
  public abort(): void {
    if (this.aborted) return
    this.aborted = true
    this.memoryUsage.current = 0
    this.cleanupResources()
    this.doneCallback()
  }

  private cleanupResources(): void {
    // Clean up any remaining resources
    this.itr.return?.()
    this.memoryUsage.current = 0
    this.done = true
  }

  private checkMemoryUsage(size: number): void {
    this.memoryUsage.current += size
    if (this.memoryUsage.current > this.maxMemoryUsage) {
      this.cleanupResources()
      throw new MemoryError('Memory usage exceeded limit', {
        current: this.memoryUsage.current,
        limit: this.maxMemoryUsage
      })
    }
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  async *[Symbol.asyncIterator]() {
    for await (const message of this.itr) {
      if ('error' in message) {
        throw new Error(message.error)
      }
      yield message
      // message will be done in the case of chat and generate
      // message will be success in the case of a progress response (pull, push, create)
      if ((message as any).done || (message as any).status === 'success') {
        this.doneCallback()
        return
      }
    }
    throw new Error('Did not receive done or success response in stream.')
  }
}

/**
 * Checks if the response is ok, if not throws an error.
 * If the response is not ok, it will try to parse the response as JSON and use the error field as the error message.
 * @param response {Response} - The response object to check
 */
const checkOk = async (response: Response): Promise<void> => {
  if (response.ok) {
    return
  }
  let message = `Error ${response.status}: ${response.statusText}`
  let errorData: ErrorResponse | null = null

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      errorData = (await response.json()) as ErrorResponse
      message = errorData.error || message
    } catch (error) {
      console.log('Failed to parse error response as JSON')
    }
  } else {
    try {
      console.log('Getting text from response')
      const textResponse = await response.text()
      message = textResponse || message
    } catch (error) {
      console.log('Failed to get text from error response')
    }
  }

  throw new ResponseError(message, response.status)
}

/**
 * Returns the platform string based on the environment.
 * @returns {string} - The platform string
 */
function getPlatform(): string {
  if (typeof window !== 'undefined' && window.navigator) {
    return `${window.navigator.platform.toLowerCase()} Browser/${navigator.userAgent};`
  } else if (typeof process !== 'undefined') {
    return `${process.arch} ${process.platform} Node.js/${process.version}`
  }
  return '' // unknown
}

/**
 * A wrapper around fetch that adds default headers.
 * @param fetch {Fetch} - The fetch function to use
 * @param url {string} - The URL to fetch
 * @param options {RequestInit} - The fetch options
 * @returns {Promise<Response>} - The fetch response
 */
const fetchWithHeaders = async (
  fetch: Fetch,
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `ollama-js/${version} (${getPlatform()})`,
  } as HeadersInit

  if (!options.headers) {
    options.headers = {}
  }

  // Filter out default headers from custom headers
  const customHeaders = Object.fromEntries(
    Object.entries(options.headers).filter(([key]) => !Object.keys(defaultHeaders).some(defaultKey => defaultKey.toLowerCase() === key.toLowerCase()))
  )

  options.headers = {
    ...defaultHeaders,
    ...customHeaders
  }

  return fetch(url, options)
}

/**
 * A wrapper around the get method that adds default headers.
 * @param fetch {Fetch} - The fetch function to use
 * @param host {string} - The host to fetch
 * @returns {Promise<Response>} - The fetch response
 */
<<<<<<< HEAD
export const get = async (fetch: Fetch, host: string, options?: { headers?: HeadersInit }): Promise<Response> => {
  const response = await fetchWithHeaders(fetch, host, {
    headers: options?.headers
  })
=======
export async function get(
  fetch: Fetch,
  host: string,
  options: { headers?: HeadersInit } = {}
): Promise<Response> {
  if (!host) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: 'Host is required',
    })
  }
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

  await checkOk(response)

  return response
}
/**
 * A wrapper around the head method that adds default headers.
 * @param fetch {Fetch} - The fetch function to use
 * @param host {string} - The host to fetch
 * @returns {Promise<Response>} - The fetch response
 */
<<<<<<< HEAD
export const head = async (fetch: Fetch, host: string): Promise<Response> => {
  const response = await fetchWithHeaders(fetch, host, {
    method: 'HEAD',
  })
=======
export async function head(fetch: Fetch, host: string): Promise<Response> {
  if (!host) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: 'Host is required',
    })
  }
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

  await checkOk(response)

  return response
}
/**
 * A wrapper around the post method that adds default headers.
 * @param fetch {Fetch} - The fetch function to use
 * @param host {string} - The host to fetch
 * @param data {Record<string, unknown> | BodyInit} - The data to send
 * @param options {{ signal: AbortSignal }} - The fetch options
 * @returns {Promise<Response>} - The fetch response
 */
export const post = async (
  fetch: Fetch,
  host: string,
  data?: Record<string, unknown> | BodyInit,
<<<<<<< HEAD
  options?: { signal?: AbortSignal, headers?: HeadersInit },
): Promise<Response> => {
  const isRecord = (input: any): input is Record<string, unknown> => {
    return input !== null && typeof input === 'object' && !Array.isArray(input)
=======
  options: { signal?: AbortSignal; headers?: HeadersInit } = {}
): Promise<Response> {
  if (!host) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: 'Host is required',
    })
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  const formattedData = isRecord(data) ? JSON.stringify(data) : data

  const response = await fetchWithHeaders(fetch, host, {
    method: 'POST',
    body: formattedData,
    signal: options?.signal,
    headers: options?.headers
  })

  await checkOk(response)

  return response
}
/**
 * A wrapper around the delete method that adds default headers.
 * @param fetch {Fetch} - The fetch function to use
 * @param host {string} - The host to fetch
 * @param data {Record<string, unknown>} - The data to send
 * @returns {Promise<Response>} - The fetch response
 */
export const del = async (
  fetch: Fetch,
  host: string,
  data?: Record<string, unknown>,
<<<<<<< HEAD
  options?: { headers?: HeadersInit },
): Promise<Response> => {
  const response = await fetchWithHeaders(fetch, host, {
    method: 'DELETE',
    body: JSON.stringify(data),
    headers: options?.headers
  })
=======
  options: { headers?: HeadersInit } = {}
): Promise<Response> {
  if (!host) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: 'Host is required',
    })
  }
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

  await checkOk(response)

  return response
}
/**
 * Parses a ReadableStream of Uint8Array into JSON objects.
 * @param itr {ReadableStream<Uint8Array>} - The stream to parse
 * @returns {AsyncGenerator<T>} - The parsed JSON objects
 */
export const parseJSON = async function* <T = unknown>(
  itr: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const reader = itr.getReader()

  while (true) {
    const { done, value: chunk } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(chunk)

    const parts = buffer.split('\n')

    buffer = parts.pop() ?? ''

    for (const part of parts) {
      try {
        yield JSON.parse(part)
      } catch (error) {
        console.warn('invalid json: ', part)
      }
    }
  }

  for (const part of buffer.split('\n').filter((p) => p !== '')) {
    try {
      yield JSON.parse(part)
    } catch (error) {
      console.warn('invalid json: ', part)
    }
  }
}
/**
 * Formats the host string to include the protocol and port.
 * @param host {string} - The host string to format
 * @returns {string} - The formatted host string
 */
<<<<<<< HEAD
export const formatHost = (host: string): string => {
  if (!host) {
    return 'http://127.0.0.1:11434'
=======
export function formatHost(host: string): string {
  const DEFAULT_HOST = 'http://127.0.0.1:11434'
  const DEFAULT_HTTP_PORT = '80'
  const DEFAULT_HTTPS_PORT = '443'
  const DEFAULT_OLLAMA_PORT = '11434'

  const trimmedHost = host.trim()
  if (!trimmedHost) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: 'Host cannot be empty',
    })
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  let isExplicitProtocol = host.includes('://')

<<<<<<< HEAD
  if (host.startsWith(':')) {
    // if host starts with ':', prepend the default hostname
    host = `http://127.0.0.1${host}`
    isExplicitProtocol = true
=======
    // Remove trailing slash if present
    host = host.replace(/\/+$/, '')

    // Add protocol if not present
    const hasProtocol = /^[a-zA-Z]+:\/\//.test(host)
    if (!hasProtocol) {
      host = 'http://' + host
    }

    const url = new URL(host)
    
    // If port is already specified and not empty, use that
    if (url.port) {
      return url.toString().replace(/\/$/, '')
    }

    // Add default ports based on protocol and whether protocol was originally specified
    let port: string
    if (url.protocol === 'http:') {
      port = hasProtocol ? DEFAULT_HTTP_PORT : DEFAULT_OLLAMA_PORT
    } else if (url.protocol === 'https:') {
      port = DEFAULT_HTTPS_PORT
    } else {
      port = DEFAULT_OLLAMA_PORT
    }

    return `${url.protocol}//${url.hostname}:${port}`
  } catch (error) {
    throw new BaseError(ErrorType.VALIDATION, {
      message: `Invalid host: ${host}`,
      details: error,
    })
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  if (!isExplicitProtocol) {
    host = `http://${host}`
  }

  const url = new URL(host)

  let port = url.port
  if (!port) {
    if (!isExplicitProtocol) {
      port = '11434'
    } else {
      // Assign default ports based on the protocol
      port = url.protocol === 'https:' ? '443' : '80'
    }
  }

  let formattedHost = `${url.protocol}//${url.hostname}:${port}${url.pathname}`
  // remove trailing slashes
  if (formattedHost.endsWith('/')) {
    formattedHost = formattedHost.slice(0, -1)
  }

  return formattedHost
}
