import * as utils from './utils.js'
import { AbortableAsyncIterator } from './utils.js'

import fs, { createReadStream, promises } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'
import { homedir } from 'os'
import { Ollama as OllamaBrowser } from './browser.js'

import type { CreateRequest, ProgressResponse } from './interfaces.js'
import { a } from 'vitest/dist/chunks/suite.B2jumIFP.js'

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
   * Parse the modelfile and replace the FROM and ADAPTER commands with the corresponding blob hashes.
   * @param modelfile {string} - The modelfile content
   * @param mfDir {string} - The directory of the modelfile
   * @private @internal
   */
  private async parseModelfile(
    model: string,
    modelfile: string,
    baseDir: string = process.cwd(),
  ): Promise<CreateRequest> {
    const lines = modelfile.split('\n');
    const request: CreateRequest = {
      model,
      files: {},
      adapters: {},
      parameters: {},
    };
  
    let multilineBuffer = '';
    let currentCommand = '';
  
    for (const line of lines) {
      const [command, ...rest] = line.split(' ');
      let lineArgs = rest.join(' ').trim();
  
      // Handle multiline arguments
      if (lineArgs.startsWith('"""')) {
        if (lineArgs.endsWith('"""') && lineArgs.length > 6) {
          // Single-line block
          multilineBuffer = lineArgs.slice(3, -3);
        } else {
          // Start multiline block
          multilineBuffer = lineArgs.slice(3);
          currentCommand = command.toUpperCase();
          continue;
        }
      } else if (multilineBuffer) {
        // Accumulate multiline content
        if (lineArgs.endsWith('"""')) {
          multilineBuffer += '\n' + lineArgs.slice(0, -3);
          lineArgs = multilineBuffer;
          multilineBuffer = '';
        } else {
          multilineBuffer += '\n' + lineArgs;
          continue;
        }
      }
  
      const args = multilineBuffer || lineArgs.replace(/^"(.*)"$/, '$1');
  
      // Handle commands
      switch ((currentCommand || command).toUpperCase()) {
        case 'FROM': {
          const path = this.resolvePath(args, baseDir);
          if (await this.fileExists(path)) {
            request.files = {
              ...request.files,
              [args]: await this.createBlob(path),
            };
          } else {
            request.from = args;
          }
          break;
        }
        case 'ADAPTER': {
          const path = this.resolvePath(args, baseDir);
          if (await this.fileExists(path)) {
            request.adapters = {
              ...request.adapters,
              [args]: await this.createBlob(path),
            };
          }
          break;
        }
        case 'TEMPLATE':
          request.template = args;
          break;
        case 'SYSTEM':
          request.system = args;
          break;
        case 'MESSAGE': {
          const [role, content] = args.split(': ', 2);
          request.messages = request.messages || [];
          request.messages.push({ role, content });
          break;
        }
        case 'LICENSE':
          request.license = request.license || [];
          request.license.push(args);
          break;
          default: {
            if (!request.parameters) {
              request.parameters = {}
            }
              request.parameters[command.toLowerCase()] = args
            }
          }
  
      currentCommand = '';
      multilineBuffer = '';
    }
  
    return request;
  }  

  /**
   * Resolve the path to an absolute path.
   * @param inputPath {string} - The input path
   * @param mfDir {string} - The directory of the modelfile
   * @private @internal
   */
  private resolvePath(inputPath, mfDir) {
    if (inputPath.startsWith('~')) {
      return join(homedir(), inputPath.slice(1))
    }
    return resolve(mfDir, inputPath)
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

    // Create a stream for reading the file
    const fileStream = createReadStream(path)

    // Compute the SHA256 digest
    const sha256sum = await new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256')
      fileStream.on('data', (data) => hash.update(data))
      fileStream.on('end', () => resolve(hash.digest('hex')))
      fileStream.on('error', reject)
    })

    const digest = `sha256:${sha256sum}`

    try {
      await utils.head(this.fetch, `${this.config.host}/api/blobs/${digest}`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
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

  create(
    request: CreateRequest & { stream: true },
  ): Promise<AbortableAsyncIterator<ProgressResponse>>
  create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>

  async create(
    request: CreateRequest,
  ): Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>> {
    // let modelfileContent = ''
    // if (request.path) {
    //   modelfileContent = await promises.readFile(request.path, { encoding: 'utf8' })
    //   modelfileContent = await this.parseModelfile(
    //     request.model,
    //     modelfileContent,
    //     dirname(request.path),
    //   )
    // } else if (request.modelfile) {
    //   modelfileContent = await this.parseModelfile(request.model, request.modelfile)
    // } else {
    //   throw new Error('Must provide either path or modelfile to create a model')
    // }
    // request.modelfile = modelfileContent

    // check stream here so that typescript knows which overload to use
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
