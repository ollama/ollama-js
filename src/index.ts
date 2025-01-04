import * as utils from './utils.js'
import { AbortableAsyncIterator } from './utils.js'

import fs, { createReadStream, promises } from 'fs'
import { join, resolve, basename } from 'path'
import { createHash } from 'crypto'
import { homedir } from 'os'
import glob from 'glob'
import { Ollama as OllamaBrowser } from './browser.js'

import type { CreateRequest, ProgressResponse } from './interfaces.js'

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

  private async createBlob(path: string): Promise<string> {
    if (typeof ReadableStream === 'undefined') {
      // Not all fetch implementations support streaming
      // TODO: support non-streaming uploads
      throw new Error('Streaming uploads are not supported in this environment.')
    }


    const hash = createHash('sha256')
    const stream = createReadStream(path)
    for await (const chunk of stream) {
      hash.update(chunk)
    }
    const digest = `sha256:${hash.digest('hex')}`

    try {
      await utils.head(this.fetch, `${this.config.host}/api/blobs/${digest}`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        const fileStream = createReadStream(path)
        // Create a new readable stream for the fetch request
        const readableStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              controller.enqueue(chunk) // Enqueue the chunk directly
            })

            fileStream.on('end', () => {
              controller.close() // Close the stream when the file ends
            })

            fileStream.on('error', (err) => {
              controller.error(err) // Propagate errors to the stream
            })
          },
        })

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
  
  async findModelFiles(path: string): Promise<string[]> {
    const files: string[] = []
    const modelPath = resolve(path)
  
    // Check for various model file patterns
    const patterns = [
      'model*.safetensors',
      'adapters.safetensors', 
      'adapter_model.safetensors',
      'pytorch_model*.bin',
      'consolidated*.pth',
      '*.gguf',
      '*.bin'
    ]
  
    // Look for model files
    for (const pattern of patterns) {
      const matches = glob.sync(join(modelPath, pattern))
      if (matches.length > 0) {
        files.push(...matches)
        break
      }
    }
  
    if (files.length === 0) {
      throw new Error('No model files found')
    }
  
    // Add config and tokenizer files
    try {
      const configFiles = glob.sync(join(modelPath, '*.json'))
      files.push(...configFiles)
  
      const nestedConfigFiles = glob.sync(join(modelPath, '**/*.json'))
      files.push(...nestedConfigFiles)
  
      const tokenizerFiles = glob.sync(join(modelPath, 'tokenizer.model'))
      if (tokenizerFiles.length > 0) {
        files.push(...tokenizerFiles)
      } else {
        const nestedTokenizerFiles = glob.sync(join(modelPath, '**/tokenizer.model'))
        files.push(...nestedTokenizerFiles)
      }
    } catch (e) {
      // Continue if config/tokenizer files not found
    }
  
    return files
  }

  async files(from: string): Promise<Record<string, string>> {
      // Check if from is a local file/directory
      const exists = await this.fileExists(from)
      if (!exists) {
        // If not a local path, assume it's a model name
        return {}
      }
  
      const fileMap: Record<string, string> = {}
      const stats = await promises.stat(from)
      let files: string[]
      if (stats.isDirectory()) {
        files = await this.findModelFiles(from)
      } else {
        files = [from]
      }
  
      for (const file of files) {
        const digest = await this.createBlob(file)
        fileMap[basename(file)] = digest
      }
  
    return fileMap
  }

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>

  async create(request: CreateRequest): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
    if (request.from && !request.files) {
      request.files = await this.files(request.from)
    }
  
    // Handle stream flag
    if (request.stream) {
      return super.create(request as CreateRequest & { stream: true })
    } else {
      return super.create(request as CreateRequest & { stream: false })
    }
  }
}

export default new Ollama()

// export all types from the main entry point so that packages importing types dont need to specify paths
export * from './interfaces.js'
