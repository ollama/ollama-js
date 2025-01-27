import ollama from 'ollama'

const stream = await ollama.create({
    model: 'my-model',
    from: 'smollm2',
    system: 'You are a helpful assistant.',
    stream: true,
  })
for await (const part of stream) {
  console.log(part)
}
