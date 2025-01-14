<<<<<<< HEAD
import { AbortableAsyncIterator } from './utils.js'

import fs, { promises } from 'fs'
import { resolve } from 'path'
import { Ollama as OllamaBrowser } from './browser.js'
=======
import * as utils from './utils'
import { AbortableAsyncIterator } from './utils'

import fs, { createReadStream, promises } from 'fs'
import { dirname, join, resolve } from 'path'
import { createHash } from 'crypto'
import { homedir } from 'os'
import { Ollama as OllamaBrowser } from './browser'
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)

import type { CreateRequest, ProgressResponse } from './interfaces'

class ValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message)
  }
}

export class Ollama extends OllamaBrowser {
  async encodeImage(image: Uint8Array | Buffer | string): Promise<string> {
    if (typeof image !== 'string') {
      try {
        return Buffer.from(image).toString('base64')
      } catch (error) {
        throw new ValidationError('Failed to encode binary image data', error)
      }
    }

    try {
      if (fs.existsSync(image)) {
        const fileBuffer = await promises.readFile(resolve(image))
        return Buffer.from(fileBuffer).toString('base64')
      }
    } catch (error) {
      throw new ValidationError('Failed to read or encode image file', {
        path: image,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // Validate if the string is base64
    try {
      Buffer.from(image, 'base64')
      return image
    } catch (error) {
      throw new ValidationError('Invalid base64 string provided', error)
    }
  }

  /**
<<<<<<< HEAD
=======
   * Parse the modelfile and replace the FROM and ADAPTER commands with the corresponding blob hashes.
   * @param modelfile {string} - The modelfile content
   * @param mfDir {string} - The directory of the modelfile
   * @private @internal
   */
  private async parseModelfile(
    modelfile: string,
    mfDir: string = process.cwd(),
  ): Promise<string> {
    const out: string[] = []
    const lines = modelfile.split('\n')
    for (const line of lines) {
      const [command, args] = line.split(' ', 2)
      if (['FROM', 'ADAPTER'].includes(command.toUpperCase())) {
        const path = this.resolvePath(args.trim(), mfDir)
        if (await this.fileExists(path)) {
          out.push(`${command} @${await this.createBlob(path)}`)
        } else {
          out.push(`${command} ${args}`)
        }
      } else {
        out.push(line)
      }
    }
    return out.join('\n')
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

  /**
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
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
    // fail if request.from is a local path
    // TODO: https://github.com/ollama/ollama-js/issues/191
    if (request.from && await this.fileExists(resolve(request.from))) {
      throw Error('Creating with a local path is not currently supported from ollama-js')
    }

    if (request.stream) {
      return super.create(request as CreateRequest & { stream: true })
    } else {
      return super.create(request as CreateRequest & { stream: false })
    }
  }
}

export function loadModel(inputPath: string, mfDir: string): Promise<void> {
  // TO DO: implement loadModel function
}

export default new Ollama()

// Core exports
export * from './browser'
export * from './interfaces'

// Performance monitoring
export * from './monitoring/metrics'
export * from './monitoring/reporting'
export * from './monitoring/visualization'

// Storage
export * from './storage/storage'

// Utils
export * from './utils/errors'
export * from './utils/version'
export * from './utils/common'

// Types
export * from './types'
