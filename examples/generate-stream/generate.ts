import ollama from 'ollama'

async function main(): Promise<void> {
  const stream = await ollama.generate({
    model: 'mistral',
    prompt: 'Why is the sky blue?',
    stream: true,
  })
  for await (const part of stream) {
    process.stdout.write(part.response)
  }
}

await main()
