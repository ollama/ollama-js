import { createHash } from 'node:crypto'
import { createReadStream, promises } from 'node:fs'
import { basename } from 'node:path'

/**
 * Computes the SHA256 hash of a file in a memory-efficient way.
 *
 * @param filepath - The path to the file
 * @returns A promise that resolves to the hex-encoded SHA256 hash
 */
export async function computeFileSHA256(filepath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(filepath, { highWaterMark: 64 * 1024 }) // 64KB chunks
  const reader = stream[Symbol.asyncIterator]()

  while (true) {
    const { done, value } = await reader.next()
    if (done) break
    hash.update(value)
  }

  return hash.digest('hex')
}

/**
 * Checks if a path exists and is a file.
 *
 * @param filepath - The path to check
 * @returns A promise that resolves to true if the path exists and is a file
 */
export async function isFile(filepath: string): Promise<boolean> {
  try {
    const stats = await promises.stat(filepath)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * Uploads a file as a blob to Ollama server.
 * 
 * @param host - The Ollama server host URL
 * @param filepath - Path to the file to upload
 * @param sha256 - SHA256 digest of the file
 * @param fetchFn - The fetch function to use for HTTP requests
 * @param headers - Optional headers to include in requests
 * @returns A promise that resolves when upload is complete
 */
export async function uploadBlob(
  host: string,
  filepath: string,
  sha256: string,
  fetchFn: typeof fetch,
  headers?: Record<string, string>
): Promise<void> {
  const digest = `sha256:${sha256}`
  const url = `${host}/api/blobs/${digest}`

  // Check if blob already exists
  try {
    const headResponse = await fetchFn(url, {
      method: 'HEAD',
      headers: headers,
    })
    if (headResponse.ok) {
      // Blob already exists, no need to upload
      return
    }
  } catch {
    // Blob doesn't exist, proceed with upload
  }

  // Stream the file for upload
  const fileStream = createReadStream(filepath)
  
  const response = await fetchFn(url, {
    method: 'POST',
    body: fileStream as any,
    headers: {
      ...headers,
      'Content-Type': 'application/octet-stream',
    },
    // @ts-expect-error - duplex is required for streaming bodies in Node.js fetch
    duplex: 'half',
  })

  if (!response.ok) {
    let message = `Failed to upload blob: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      message = errorData.error || message
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message)
  }
}

/**
 * Creates a map of filenames to blob digests for the Ollama create request.
 * 
 * @param files - Array of file objects with filepath and optional sha256
 * @param blobDigests - Array of blob digests (sha256:hash format)
 * @returns A map of filename to blob digest
 */
export function createBlobFileMap(
  files: Array<{ filepath: string; sha256?: string }>,
  blobDigests: string[]
): Record<string, string> {
  const fileMap: Record<string, string> = {}
  
  for (let i = 0; i < files.length; i++) {
    const filename = basename(files[i].filepath)
    fileMap[filename] = blobDigests[i]
  }
  
  return fileMap
}

/**
 * Replaces local file path references in a modelfile with blob digest references.
 * 
 * @param modelfile - The modelfile content
 * @param blobDigests - Array of blob digests to use as replacements
 * @returns The modelfile with blob references
 */
export function replaceModelfilePathsWithBlobs(
  modelfile: string,
  blobDigests: string[]
): string {
  let updatedModelfile = modelfile
  
  // Replace local file paths with blob references
  for (const blobDigest of blobDigests) {
    updatedModelfile = updatedModelfile.replace(
      new RegExp(`\\.\\/[^\\s]+\\.gguf`, 'i'),
      `@${blobDigest}`
    )
  }
  
  return updatedModelfile
}
