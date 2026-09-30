import { AbortableAsyncIterator } from './utils.js'

import fs, { promises } from 'node:fs'
import { resolve } from 'node:path'
import { Ollama as OllamaBrowser } from './browser.js'

import type { CreateRequest, ProgressResponse } from './interfaces.js'

import { 
  computeFileSHA256, 
  isFile, 
  uploadBlob, 
  createBlobFileMap, 
} from './fileUpload.js'

export class Ollama extends OllamaBrowser {
  async encodeImage(image: Uint8Array | Buffer | string): Promise<string> {
    if (typeof image !== 'string') {
      // image is Uint8Array or Buffer, convert it to base64
      return Buffer.from(image).toString('base64')
    }
    try {
      if (fs.existsSync(image)) {
        // this is a filepath, read the file and convert it to base64
        const fileBuffer = await promises.readFile(resolve(image))
        return Buffer.from(fileBuffer).toString('base64')
      }
    } catch {
      // continue
    }
    // the string may be base64 encoded
    return image
  }

  /**
   * checks if a file exists
   * @param path {string} - The path to the file
   * @private @internal
   * @returns {Promise<boolean>} - Whether the file exists or not
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await promises.access(path)
      return true
    } catch {
      return false
    }
  }

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>

  async create(
    request: CreateRequest,
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
    // Handle local file uploads
    // API compatibility: ollama version 0.14.1
    // todo: need to test compatibility for other ollama versions as well
    if (request.files !== undefined) {
      if (request.files.length < 1) {
        throw new Error('At least one file must be specified when using file upload')
      }
      return this.createFromFiles(request)
    }

    // Handle local path in 'from' field (legacy support with modelfile - with error)
    if (request.from && await this.fileExists(resolve(request.from))) {
      throw Error('Creating with a local path is not currently supported from ollama-js. Please use the files parameter instead.')
    }

    if (request.stream) {
      return super.create(request as CreateRequest & { stream: true })
    } else {
      return super.create(request as CreateRequest & { stream: false })
    }
  }

  /**
   * Creates a model from local files by first uploading them as blobs.
   * This method handles memory-efficient streaming of large model files.
   *
   * @param request {CreateRequest} - The request object containing model name and files
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or a stream of progress responses
   */
  private async createFromFiles(
    request: CreateRequest,
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
    if (!request.files || request.files.length === 0) {
      throw new Error('At least one file must be specified when using file upload')
    }

    // Validate all files exist
    await this.validateFiles(request.files)

    // Upload files as blobs and get their digests
    const blobDigests = await this.uploadFilesAsBlobs(request.files)

    // Build the modified request with blob references
    const modifiedRequest: Record<string, any> = {
      ...request,
      files: createBlobFileMap(request.files, blobDigests),
    }

    return this.processStreamableRequest<ProgressResponse>('create', modifiedRequest)
  }

  /**
   * Validates that all files exist.
   */
  private async validateFiles(files: Array<{ filepath: string; sha256?: string }>): Promise<void> {
    for (const file of files) {
      const absolutePath = resolve(file.filepath)
      if (!(await isFile(absolutePath))) {
        throw new Error(`File not found: ${file.filepath}`)
      }
    }
  }

  /**
   * Uploads files as blobs and returns their digests.
   */
  private async uploadFilesAsBlobs(files: Array<{ filepath: string; sha256?: string }>): Promise<string[]> {
    const blobDigests: string[] = []
    
    for (const file of files) {
      const absolutePath = resolve(file.filepath)
      const sha256 = file.sha256 || await computeFileSHA256(absolutePath)
      
      // Upload file as a blob
      await uploadBlob(this.config.host, absolutePath, sha256, this.fetch, this.config.headers)
      blobDigests.push(`sha256:${sha256}`)
    }
    
    return blobDigests
  }


}

export default new Ollama()

// export all types from the main entry point so that packages importing types dont need to specify paths
export * from './interfaces.js'

export type { AbortableAsyncIterator }
