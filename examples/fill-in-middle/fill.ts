import ollama from 'ollama'

async function main() {
  const response = await ollama.generate({
    model: 'deepseek-coder-v2',
    prompt: `def add(`,
    suffix: `return c`,
  })
  console.log(response.response)
}

main().catch(console.error)
