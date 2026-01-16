import { createHash } from 'node:crypto'
import { createReadStream, promises } from 'node:fs'

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
