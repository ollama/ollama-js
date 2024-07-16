import ollama from 'ollama'

const response = await ollama.generate({
  model: 'deepseek-coder-v2',
  prompt: `def add(`,
  suffix: `return c`,
})
console.log(response.response)
