import ollama from 'ollama'
import { readFile } from 'node:fs/promises'

async function main() {
  const image = await readFile(new URL('./cat.jpg', import.meta.url))
  const response = await ollama.generate({
    model: 'gemma4',
    prompt: 'describe this image:',
    images: [image],
    stream: true,
  })
  for await (const part of response) {
    process.stdout.write(part.response ?? '')
  }
}

main().catch(console.error)
