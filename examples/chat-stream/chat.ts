import ollama, { Message } from 'ollama'

async function main(): Promise<void> {
  const messages: Message[] = [{ role: 'user', content: 'Why is the sky blue?' }]
  const stream = await ollama.chat({ model: 'mistral', messages, stream: true })
  for await (const part of stream) {
    process.stdout.write(part.message.content)
  }
}

await main()
