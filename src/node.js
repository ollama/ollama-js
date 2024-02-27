const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const { createHash } = require('crypto')
const { homedir } = require('os')

async function parseModelfile(ollama, modelfile, mfDir = process.cwd()) {
  const out = []
  const lines = modelfile.split('\n')
  for (const line of lines) {
    const [command, args] = line.split(' ', 2)
    if (['FROM', 'ADAPTER'].includes(command.toUpperCase())) {
      const resolvedPath = resolvePath(args.trim(), mfDir)
      if (await fileExists(resolvedPath)) {
        out.push(`${command} @${await createBlob(ollama, resolvedPath)}`)
      } else {
        out.push(`${command} ${args}`)
      }
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}

function resolvePath(inputPath, mfDir) {
  if (inputPath.startsWith('~')) {
    return path.join(homedir(), inputPath.slice(1))
  }
  return path.resolve(mfDir, inputPath)
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

async function createBlob(ollama, filePath) {
  if (typeof ReadableStream === 'undefined') {
    throw new Error('Streaming uploads are not supported in this environment.')
  }

  const fileStream = fs.createReadStream(filePath)
  const sha256sum = await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    fileStream.on('data', (data) => hash.update(data))
    fileStream.on('end', () => resolve(hash.digest('hex')))
    fileStream.on('error', reject)
  })

  const digest = `sha256:${sha256sum}`

  try {
    await utils.head(ollama.fetch, `${ollama.config.host}/api/blobs/${digest}`, {
      signal: ollama.abortController.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) {
      const readableStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => {
            controller.enqueue(chunk)
          })

          fileStream.on('end', () => {
            controller.close()
          })

          fileStream.on('error', (err) => {
            controller.error(err)
          })
        },
      })

      await utils.post(
        ollama.fetch,
        `${ollama.config.host}/api/blobs/${digest}`,
        readableStream,
        { signal: ollama.abortController.signal },
      )
    } else {
      throw e
    }
  }

  return digest
}

export async function readModelfile(ollama, request) {
  let modelfileContent = ''
  if (request.path) {
    modelfileContent = await fs.promises.readFile(request.path, { encoding: 'utf8' })
    modelfileContent = await parseModelfile(
      ollama,
      modelfileContent,
      path.dirname(request.path),
    )
  } else if (request.modelfile) {
    modelfileContent = await parseModelfile(ollama, request.modelfile)
  } else {
    throw new Error('Must provide either path or modelfile to create a model')
  }

  return modelfileContent
}

export async function readImage(imgPath) {
  if (fs.existsSync(imgPath)) {
    // this is a filepath, read the file and convert it to base64
    const fileBuffer = await fs.promises.readFile(path.resolve(imgPath))
    return Buffer.from(fileBuffer).toString('base64')
  }
  throw new Error(`Image path ${imgPath} does not exist`)
}
