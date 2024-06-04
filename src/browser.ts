import * as utils from './utils.js'
import 'whatwg-fetch'

import type {
  ChatRequest,
  ChatResponse,
  Config,
  CopyRequest,
  CreateRequest,
  DeleteRequest,
  EmbeddingsRequest,
  EmbeddingsResponse,
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
} from './interfaces.js'

export class Ollama {
  protected readonly config: Config
  protected readonly fetch: Fetch
  private abortController: AbortController

  constructor(config?: Partial<Config>) {
    this.config = {
      host: '',
    }
    if (!config?.proxy) {
      this.config.host = utils.formatHost(config?.host ?? 'http://127.0.0.1:11434')
    }

    this.fetch = fetch
    if (config?.fetch != null) {
      this.fetch = config.fetch
    }

    this.abortController = new AbortController()
  }

  // Abort any ongoing requests to Ollama
  public abort() {
    this.abortController.abort()
    this.abortController = new AbortController()
  }

  /**
   * Processes a request to the Ollama server. If the request is streamable, it will return an
   * AsyncGenerator that yields the response messages. Otherwise, it will return the response
   * object.
   * @param endpoint {string} - The endpoint to send the request to.
   * @param request {object} - The request object to send to the endpoint.
   * @protected {T | AsyncGenerator<T>} - The response object or an AsyncGenerator that yields
   * response messages.
   * @throws {Error} - If the response body is missing or if the response is an error.
   * @returns {Promise<T | AsyncGenerator<T>>} - The response object or an AsyncGenerator that yields the streamed response.
   */
  protected async processStreamableRequest<T extends object>(
    endpoint: string,
    request: { stream?: boolean } & Record<string, any>,
  ): Promise<T | AsyncGenerator<T>> {
    request.stream = request.stream ?? false
    const response = await utils.post(
      this.fetch,
      `${this.config.host}/api/${endpoint}`,
      {
        ...request,
      },
      { signal: this.abortController.signal },
    )

    if (!response.body) {
      throw new Error('Missing body')
    }

    const itr = utils.parseJSON<T | ErrorResponse>(response.body)

    if (request.stream) {
      return (async function* () {
        for await (const message of itr) {
          if ('error' in message) {
            throw new Error(message.error)
          }
          yield message
          // message will be done in the case of chat and generate
          // message will be success in the case of a progress response (pull, push, create)
          if ((message as any).done || (message as any).status === 'success') {
            return
          }
        }
        throw new Error('Did not receive done or success response in stream.')
      })()
    } else {
      const message = await itr.next()
      if (!message.value.done && (message.value as any).status !== 'success') {
        throw new Error('Expected a completed response.')
      }
      return message.value
    }
  }

  /**
   * Encodes an image to base64 if it is a Uint8Array.
   * @param image {Uint8Array | string} - The image to encode.
   * @returns {Promise<string>} - The base64 encoded image.
   */
  async encodeImage(image: Uint8Array | string): Promise<string> {
    if (typeof image !== 'string') {
      // image is Uint8Array convert it to base64
      const uint8Array = new Uint8Array(image)
      const numberArray = Array.from(uint8Array)
      return btoa(String.fromCharCode.apply(null, numberArray))
    }
    // the string may be base64 encoded
    return image
  }

  generate(
    request: GenerateRequest & { stream: true },
  ): Promise<AsyncGenerator<GenerateResponse>>
  generate(request: GenerateRequest & { stream?: false }): Promise<GenerateResponse>
  /**
   * Generates a response from a text prompt.
   * @param request {GenerateRequest} - The request object.
   * @returns {Promise<GenerateResponse | AsyncGenerator<GenerateResponse>>} - The response object or
   * an AsyncGenerator that yields response messages.
   */
  async generate(
    request: GenerateRequest,
  ): Promise<GenerateResponse | AsyncGenerator<GenerateResponse>> {
    if (request.images) {
      request.images = await Promise.all(request.images.map(this.encodeImage.bind(this)))
    }
    return this.processStreamableRequest<GenerateResponse>('generate', request)
  }

  chat(request: ChatRequest & { stream: true }): Promise<AsyncGenerator<ChatResponse>>
  chat(request: ChatRequest & { stream?: false }): Promise<ChatResponse>
  /**
   * Chats with the model. The request object can contain messages with images that are either
   * Uint8Arrays or base64 encoded strings. The images will be base64 encoded before sending the
   * request.
   * @param request {ChatRequest} - The request object.
   * @returns {Promise<ChatResponse | AsyncGenerator<ChatResponse>>} - The response object or an
   * AsyncGenerator that yields response messages.
   */
  async chat(request: ChatRequest): Promise<ChatResponse | AsyncGenerator<ChatResponse>> {
    if (request.messages) {
      for (const message of request.messages) {
        if (message.images) {
          message.images = await Promise.all(
            message.images.map(this.encodeImage.bind(this)),
          )
        }
      }
    }
    return this.processStreamableRequest<ChatResponse>('chat', request)
  }

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AsyncGenerator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Creates a new model from a stream of data.
   * @param request {CreateRequest} - The request object.
   * @returns {Promise<ProgressResponse | AsyncGenerator<ProgressResponse>>} - The response object or a stream of progress responses.
   */
  async create(
    request: CreateRequest,
  ): Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
    return this.processStreamableRequest<ProgressResponse>('create', {
      name: request.model,
      stream: request.stream,
      modelfile: request.modelfile,
      quantize: request.quantize,
    })
  }

  pull(request: PullRequest & { stream: true }): Promise<AsyncGenerator<ProgressResponse>>
  pull(request: PullRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Pulls a model from the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PullRequest} - The request object.
   * @returns {Promise<ProgressResponse | AsyncGenerator<ProgressResponse>>} - The response object or
   * an AsyncGenerator that yields response messages.
   */
  async pull(
    request: PullRequest,
  ): Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
    return this.processStreamableRequest<ProgressResponse>('pull', {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure,
    })
  }

  push(request: PushRequest & { stream: true }): Promise<AsyncGenerator<ProgressResponse>>
  push(request: PushRequest & { stream?: false }): Promise<ProgressResponse>
  /**
   * Pushes a model to the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PushRequest} - The request object.
   * @returns {Promise<ProgressResponse | AsyncGenerator<ProgressResponse>>} - The response object or
   * an AsyncGenerator that yields response messages.
   */
  async push(
    request: PushRequest,
  ): Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
    return this.processStreamableRequest<ProgressResponse>('push', {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure,
    })
  }

  /**
   * Deletes a model from the server. The request object should contain the name of the model to
   * delete.
   * @param request {DeleteRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async delete(request: DeleteRequest): Promise<StatusResponse> {
    await utils.del(this.fetch, `${this.config.host}/api/delete`, {
      name: request.model,
    })
    return { status: 'success' }
  }

  /**
   * Copies a model from one name to another. The request object should contain the name of the
   * model to copy and the new name.
   * @param request {CopyRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async copy(request: CopyRequest): Promise<StatusResponse> {
    await utils.post(this.fetch, `${this.config.host}/api/copy`, { ...request })
    return { status: 'success' }
  }

  /**
   * Lists the models on the server.
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async list(): Promise<ListResponse> {
    const response = await utils.get(this.fetch, `${this.config.host}/api/tags`)
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
    })
    return (await response.json()) as ShowResponse
  }

  /**
   * Embeds a text prompt into a vector.
   * @param request {EmbeddingsRequest} - The request object.
   * @returns {Promise<EmbeddingsResponse>} - The response object.
   */
  async embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    const response = await utils.post(this.fetch, `${this.config.host}/api/embeddings`, {
      ...request,
    })
    return (await response.json()) as EmbeddingsResponse
  }

  /**
   * Lists the running models on the server
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async ps(): Promise<ListResponse> {
    const response = await utils.get(this.fetch, `${this.config.host}/api/ps`)
    return (await response.json()) as ListResponse
  }
}

export default new Ollama()

// export all types from the main entry point so that packages importing types dont need to specify paths
export * from './interfaces.js'
