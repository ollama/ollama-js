import ollama from 'ollama'

async function main(): Promise<void> {
  const respose = await ollama.generate({
    model: 'mistral',
    prompt: 'Why is the sky blue?',
  })
  console.log(respose.response)
}

await main()
