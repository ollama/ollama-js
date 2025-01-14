import * as utils from './utils.js'
import { parseJSON } from './utils.js'
import { EmbedResponse } from './interfaces.js'
import { AbortableAsyncIterator, ErrorType, StreamableRequest } from './types.js'
import 'whatwg-fetch'

import type {
  ChatRequest,
  ChatResponse,
  Config,
  CopyRequest,
  CreateRequest,
  DeleteRequest,
  EmbedRequest,
<<<<<<< HEAD
  EmbedResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
=======
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  ErrorResponse,
  Fetch,
  GenerateRequest,
  GenerateResponse,
  ListResponse,
  ProgressResponse,
  PullRequest,
  PushRequest,
  ShowRequest,
  ShowResponse,
  StatusResponse,
<<<<<<< HEAD
} from './interfaces.js'

export class Ollama {
  protected readonly config: Config
  protected readonly fetch: Fetch
  protected readonly ongoingStreamedRequests: AbortableAsyncIterator<object>[] = []
=======
  ResponseType,
} from './interfaces.js'

interface OllamaConfig extends Config {
  host: string;
  headers?: Record<string, string>;
  proxy?: boolean;
  fetch?: Fetch;
}

export class Ollama {
  protected readonly config: OllamaConfig;
  protected readonly fetch: Fetch;
  protected readonly ongoingStreamedRequests: AbortableAsyncIterator<ResponseType>[] = [];
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

  constructor(config?: Partial<Config>) {
    this.config = {
      host: '',
<<<<<<< HEAD
      headers: config?.headers
    }
=======
      headers: config?.headers,
      proxy: config?.proxy
    };
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

    if (!config?.proxy) {
      this.config.host = utils.formatHost(config?.host ?? 'http://127.0.0.1:11434');
    }

    this.fetch = config?.fetch ?? (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
  }

  protected async makeRequest<T extends ResponseType>(
    endpoint: string,
    body: any,
    options: StreamableRequest<T> = {}
  ): Promise<T | AbortableAsyncIterator<T>> {
    const abortController = new AbortController();
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const response = await this.fetch(`${this.config.host}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      signal: abortController.signal
    });

    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new utils.BaseError(error.error, { type: ErrorType.VALIDATION });
    }

    if (options.stream) {
      const iterator = this.createStreamIterator<T>(response, abortController);
      this.ongoingStreamedRequests.push(iterator);
      return iterator;
    }

    return parseJSON<T>(await response.text());
  }

  protected createStreamIterator<T>(
    response: Response,
    abortController: AbortController
  ): AbortableAsyncIterator<T> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const iterator: AbortableAsyncIterator<T> = {
      async next(): Promise<IteratorResult<T>> {
        if (!reader) {
          return { done: true, value: undefined };
        }

        try {
          const { done, value } = await reader.read();
          if (done) {
            return { done: true, value: undefined };
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              const parsed = parseJSON<T>(line);
              return { done: false, value: parsed };
            }
          }

          return iterator.next();
        } catch (error) {
          if (error instanceof utils.BaseError) {
            throw error;
          }
          throw new utils.BaseError(error.message, { type: ErrorType.NETWORK });
        }
      },
      async return(): Promise<IteratorResult<T>> {
        await reader?.cancel();
        return { done: true, value: undefined };
      },
      async throw(error?: any): Promise<IteratorResult<T>> {
        await reader?.cancel();
        throw error;
      },
      abort(): void {
        abortController.abort();
      }
    };

    return iterator;
  }

  // Abort any ongoing streamed requests to Ollama
  public abort() {
    for (const request of this.ongoingStreamedRequests) {
      request.abort()
    }
    this.ongoingStreamedRequests.length = 0
  }

<<<<<<< HEAD
  /**
   * Processes a request to the Ollama server. If the request is streamable, it will return a
   * AbortableAsyncIterator that yields the response messages. Otherwise, it will return the response
   * object.
   * @param endpoint {string} - The endpoint to send the request to.
   * @param request {object} - The request object to send to the endpoint.
   * @protected {T | AbortableAsyncIterator<T>} - The response object or a AbortableAsyncIterator that yields
   * response messages.
   * @throws {Error} - If the response body is missing or if the response is an error.
   * @returns {Promise<T | AbortableAsyncIterator<T>>} - The response object or a AbortableAsyncIterator that yields the streamed response.
   */
  protected async processStreamableRequest<T extends object>(
    endpoint: string,
    request: { stream?: boolean } & Record<string, any>,
  ): Promise<T | AbortableAsyncIterator<T>> {
    request.stream = request.stream ?? false
    const host = `${this.config.host}/api/${endpoint}`
    if (request.stream) {
      const abortController = new AbortController()
      const response = await utils.post(this.fetch, host, request, {
        signal: abortController.signal,
        headers: this.config.headers
      })

      if (!response.body) {
        throw new Error('Missing body')
      }

      const itr = parseJSON<T | ErrorResponse>(response.body)
      const abortableAsyncIterator = new AbortableAsyncIterator(
        abortController,
        itr,
        () => {
          const i = this.ongoingStreamedRequests.indexOf(abortableAsyncIterator)
          if (i > -1) {
            this.ongoingStreamedRequests.splice(i, 1)
          }
        },
      )
      this.ongoingStreamedRequests.push(abortableAsyncIterator)
      return abortableAsyncIterator
    }
    const response = await utils.post(this.fetch, host, request, {
      headers: this.config.headers
    })
    return await response.json()
=======
  protected handleError(error: any): never {
    if (error?.type === ErrorType.VALIDATION) {
      throw error;
    }
    throw new Error(error?.message || 'Unknown error occurred');
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

/**
 * Encodes an image to base64 if it is a Uint8Array.
 * @param image {Uint8Array | string} - The image to encode.
 * @returns {Promise<string>} - The base64 encoded image.
 */
async encodeImage(image: Uint8Array | string): Promise<string> {
  if (typeof image !== 'string') {
    // image is Uint8Array, convert it to base64
    const uint8Array = new Uint8Array(image);
    let byteString = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      byteString += String.fromCharCode(uint8Array[i]);
    }
    return btoa(byteString);
  }
  // the string may be base64 encoded
  return image;
}

  generate(
    request: GenerateRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<GenerateResponse>>
  generate(request: GenerateRequest & { stream?: false }): Promise<GenerateResponse>
  /**
   * Generates a response from a text prompt.
   * @param request {GenerateRequest} - The request object.
   * @returns {Promise<GenerateResponse | AbortableAsyncIterator<GenerateResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async generate(
    request: GenerateRequest,
  ): Promise<GenerateResponse | AbortableAsyncIterator<GenerateResponse>> {
    if (request.images) {
      request.images = await Promise.all(request.images.map(this.encodeImage.bind(this)))
    }
    return this.makeRequest<GenerateResponse>('generate', request, { stream: request.stream })
  }

  chat(
    request: ChatRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ChatResponse>>
  chat(request: ChatRequest & { stream?: false }): Promise<ChatResponse>
  /**
   * Chats with the model. The request object can contain messages with images that are either
   * Uint8Arrays or base64 encoded strings. The images will be base64 encoded before sending the
   * request.
   * @param request {ChatRequest} - The request object.
   * @returns {Promise<ChatResponse | AbortableAsyncIterator<ChatResponse>>} - The response object or an
   * AbortableAsyncIterator that yields response messages.
   */
  async chat(
    request: ChatRequest,
  ): Promise<ChatResponse | AbortableAsyncIterator<ChatResponse>> {
    if (request.messages) {
      for (const message of request.messages) {
        if (message.images) {
          message.images = await Promise.all(
            message.images.map(this.encodeImage.bind(this)),
          )
        }
      }
    }
    return this.makeRequest<ChatResponse>('chat', request, { stream: request.stream })
  }

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Creates a new model from a stream of data.
   * @param request {CreateRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or a stream of progress responses.
   */
  async create(
    request: CreateRequest
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
<<<<<<< HEAD
    return this.processStreamableRequest<ProgressResponse>('create', {
      ...request
    })
=======
    if (!request.model) {
      throw new Error('Model name is required')
    }

    if (!request.modelfile) {
      throw new Error('Modelfile is required')
    }

    return this.makeRequest<ProgressResponse>('create', {
      name: request.model,
      stream: request.stream,
      modelfile: request.modelfile,
      quantize: request.quantize,
    }, { stream: request.stream })
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  pull(
    request: PullRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  pull(request: PullRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Pulls a model from the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PullRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async pull(
    request: PullRequest,
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
<<<<<<< HEAD
    return this.processStreamableRequest<ProgressResponse>('pull', {
=======
    if (!request.model) {
      throw new Error('Model name is required')
    }

    return this.makeRequest<ProgressResponse>('pull', {
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
      name: request.model,
      stream: request.stream,
      insecure: request.insecure,
    }, { stream: request.stream })
  }

  push(
    request: PushRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  push(request: PushRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Pushes a model to the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PushRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async push(
    request: PushRequest,
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
<<<<<<< HEAD
    return this.processStreamableRequest<ProgressResponse>('push', {
=======
    if (!request.model) {
      throw new Error('Model name is required')
    }

    return this.makeRequest<ProgressResponse>('push', {
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
      name: request.model,
      stream: request.stream,
      insecure: request.insecure,
    }, { stream: request.stream })
  }

  /**
   * Deletes a model from the server. The request object should contain the name of the model to
   * delete.
   * @param request {DeleteRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async delete(request: DeleteRequest): Promise<StatusResponse> {
    await utils.del(
      this.fetch,
      `${this.config.host}/api/delete`,
      { name: request.model },
      { headers: this.config.headers }
    )
    return { status: 'success' }
  }

  /**
   * Copies a model from one name to another. The request object should contain the name of the
   * model to copy and the new name.
   * @param request {CopyRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async copy(request: CopyRequest): Promise<StatusResponse> {
    await utils.post(this.fetch, `${this.config.host}/api/copy`, { ...request }, {
      headers: this.config.headers
    })
    return { status: 'success' }
  }

  /**
   * Lists the models on the server.
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async list(): Promise<ListResponse> {
    const response = await utils.get(this.fetch, `${this.config.host}/api/tags`, {
      headers: this.config.headers
    })
    return (await response.json()) as ListResponse
  }

  /**
   * Shows the metadata of a model. The request object should contain the name of the model.
   * @param request {ShowRequest} - The request object.
   * @returns {Promise<ShowResponse>} - The response object.
   */
  async show(request: ShowRequest): Promise<ShowResponse> {
    const response = await utils.post(this.fetch, `${this.config.host}/api/show`, {
      ...request,
    }, {
      headers: this.config.headers
    })
    return (await response.json()) as ShowResponse
  }

  /**
   * Embeds text input into vectors.
   * @param request {EmbedRequest} - The request object.
   * @returns {Promise<EmbedResponse>} - The response object.
   */
<<<<<<< HEAD
    async embed(request: EmbedRequest): Promise<EmbedResponse> {
      const response = await utils.post(this.fetch, `${this.config.host}/api/embed`, {
        ...request,
      }, {
        headers: this.config.headers
      })
      return (await response.json()) as EmbedResponse
    }

  /**
   * Embeds a text prompt into a vector.
   * @param request {EmbeddingsRequest} - The request object.
   * @returns {Promise<EmbeddingsResponse>} - The response object.
   */
  async embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
=======
  async embeddings(request: EmbedRequest): Promise<EmbedResponse> {
    if (!request.model) {
      throw new Error('Model name is required')
    }

    if (!request.prompt) {
      throw new Error('Prompt is required')
    }

>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
    const response = await utils.post(this.fetch, `${this.config.host}/api/embeddings`, {
      ...request,
    }, {
      headers: this.config.headers
    })
<<<<<<< HEAD
    return (await response.json()) as EmbeddingsResponse
=======

    if (!response.ok) {
      const error = await response.json() as ErrorResponse
      throw new Error(error.error ?? 'Unknown error')
    }

    return (await response.json()) as EmbedResponse
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
  }

  /**
   * Lists the running models on the server
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async ps(): Promise<ListResponse> {
    const response = await utils.get(this.fetch, `${this.config.host}/api/ps`, {
      headers: this.config.headers
    })
    return (await response.json()) as ListResponse
  }
}

export default new Ollama()

// export all types from the main entry point so that packages importing types dont need to specify paths
export * from './interfaces.js'
