// Image generation is experimental and currently only available on macOS

import ollama from 'ollama'
import { writeFileSync } from 'fs'

async function main() {
  const prompt = 'a sunset over mountains'
  console.log(`Prompt: ${prompt}`)

  const response = await ollama.generate({
    model: 'x/z-image-turbo',
    prompt,
    width: 1024,
    height: 768,
  })

  // Save the generated image
  const imageBuffer = Buffer.from(response.image!, 'base64')
  writeFileSync('output.png', imageBuffer)

  console.log('Image saved to output.png')
}

main().catch(console.error)
