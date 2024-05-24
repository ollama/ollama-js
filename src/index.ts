import * as utils from './utils.js'
import { fileExists, isFilePath } from './utils.js'
import { createReadStream, promises } from 'fs'
import { dirname, join, resolve } from 'path'
import { createHash } from 'crypto'
import { homedir } from 'os'
import { Ollama as OllamaBrowser } from './browser.js'

import type { CreateRequest, ProgressResponse } from './interfaces.js'
import {
  CODE_404,
  ENCODING,
  MESSAGES,
  MODEL_FILE_COMMANDS,
  SHA256,
  STREAMING_EVENTS,
} from './constants'

export class Ollama extends OllamaBrowser {
  private async encodeImageFromString(image: string): Promise<string> {
    const isPath = await isFilePath(image)
    if (isPath) {
      return this.encodeImageFromFile(image)
    }
    return image
  }

  private async encodeImageFromBuffer(image: Uint8Array | Buffer): Promise<string> {
    return Buffer.from(image).toString(ENCODING.BASE64)
  }

  private async encodeImageFromFile(path: string): Promise<string> {
    const fileBuffer = await promises.readFile(resolve(path))
    return Buffer.from(fileBuffer).toString(ENCODING.BASE64)
  }

  /**
   * Encode an image to base64.
   * @param image {Uint8Array | Buffer | string} - The image to encode
   * @returns {Promise<string>} - The base64 encoded image
   */
  async encodeImage(image: Uint8Array | Buffer | string): Promise<string> {
    if (typeof image === 'string') {
      return this.encodeImageFromString(image)
    }
    return this.encodeImageFromBuffer(image)
  }

  private async parseLine(line: string, mfDir: string): Promise<string> {
    const [command, args] = line.split(' ', 2)
    if (MODEL_FILE_COMMANDS.includes(command.toUpperCase())) {
      return this.parseCommand(command, args.trim(), mfDir)
    }
    return line
  }

  private async parseCommand(
    command: string,
    args: string,
    mfDir: string,
  ): Promise<string> {
    const path = this.resolvePath(args, mfDir)
    const exists = await fileExists(path)
    if (exists) {
      const blob = await this.createBlob(path)
      return `${command} @${blob}`
    }
    return `${command} ${args}`
  }

  /**
   * Parse the modelfile and replace the FROM and ADAPTER commands with the corresponding blob hashes.
   * @param modelfile {string} - The modelfile content
   * @param mfDir {string} - The directory of the modelfile
   * @private @internal
   */
  private async parseModelfile(
    modelfile: string,
    mfDir: string = process.cwd(),
  ): Promise<string> {
    const lines = modelfile.split('\n')
    const parsedLines = await Promise.all(
      lines.map((line) => this.parseLine(line, mfDir)),
    )
    return parsedLines.join('\n')
  }

  /**
   * Resolve the path to an absolute path.
   * @param inputPath {string} - The input path
   * @param mfDir {string} - The directory of the modelfile
   * @private @internal
   */
  private resolvePath(inputPath: string, mfDir: string) {
    if (inputPath.startsWith('~')) {
      return join(homedir(), inputPath.slice(1))
    }
    return resolve(mfDir, inputPath)
  }

  private async computeSha256(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fileStream = createReadStream(path)
      const hash = createHash(SHA256)
      fileStream.on('data', (data) => hash.update(data))
      fileStream.on('end', () => resolve(hash.digest(ENCODING.HEX)))
      fileStream.on('error', reject)
    })
  }

  private createReadableStream(path: string): ReadableStream {
    const fileStream = createReadStream(path)
    return new ReadableStream({
      start(controller) {
        fileStream.on(STREAMING_EVENTS.DATA, (chunk) => {
          controller.enqueue(chunk)
        })

        fileStream.on(STREAMING_EVENTS.END, () => {
          controller.close()
        })

        fileStream.on(STREAMING_EVENTS.ERROR, (err) => {
          controller.error(err)
        })
      },
    })
  }
  /**
   * Create a blob from a file.
   * @param path {string} - The path to the file
   * @returns {Promise<string>} - The digest of the blob
   */
  private async createBlob(path: string): Promise<string> {
    if (typeof ReadableStream === 'undefined') {
      throw new Error(MESSAGES.STREAMING_UPLOADS_NOT_SUPPORTED)
    }

    const sha256sum = await this.computeSha256(path)
    const digest = `${SHA256}:${sha256sum}`

    try {
      await utils.head(this.fetch, `${this.config.host}/api/blobs/${digest}`)
    } catch (e) {
      if (e instanceof Error && e.message.includes(CODE_404)) {
        const readableStream = this.createReadableStream(path)
        await utils.post(
          this.fetch,
          `${this.config.host}/api/blobs/${digest}`,
          readableStream,
        )
      } else {
        throw e
      }
    }

    return digest
  }

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AsyncGenerator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>

  /**
   * Create a model.
   * @param request {CreateRequest} - The request object
   * @returns {Promise<ProgressResponse | AsyncGenerator<ProgressResponse>>} - The progress response
   */
  async create(
    request: CreateRequest,
  ): Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
    request.modelfile = await this.getModelfileContent(request)

    if (request.stream) {
      return super.create(request as CreateRequest & { stream: true })
    }
    return super.create(request as CreateRequest & { stream: false })
  }

  private async getModelfileContentFromPath(path: string): Promise<string> {
    const modelfileContent = await promises.readFile(path, {
      encoding: ENCODING.UTF8,
    })
    return this.parseModelfile(modelfileContent, dirname(path))
  }
  /**
   * Get the content of the modelfile.
   * @param request {CreateRequest} - The request object
   * @returns {Promise<string>} - The content of the modelfile
   */
  private async getModelfileContent(request: CreateRequest): Promise<string> {
    if (request.path) {
      return this.getModelfileContentFromPath(request.path)
    } else if (request.modelfile) {
      return this.parseModelfile(request.modelfile)
    } else {
      throw new Error(MESSAGES.ERROR_NO_MODEL_FILE)
    }
  }
}

export default new Ollama()

// export all types from the main entry point so that packages importing types don't need to specify paths
export * from './interfaces.js'
