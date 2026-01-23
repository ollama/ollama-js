// Image generation is experimental and currently only available on macOS

import ollama from 'ollama'
import { writeFileSync } from 'fs'

async function main() {
  const prompt = 'a sunset over mountains'
  console.log(`Prompt: ${prompt}`)

  const response = await ollama.generate({
    model: 'x/z-image-turbo',
    prompt,
    stream: true,
  })

  for await (const part of response) {
    if (part.image) {
      // Final response contains the image
      const imageBuffer = Buffer.from(part.image, 'base64')
      writeFileSync('output.png', imageBuffer)
      console.log('\nImage saved to output.png')
    } else if (part.total) {
      // Progress update
      process.stdout.write(`\rProgress: ${part.completed}/${part.total}`)
    }
  }
}

main().catch(console.error)
