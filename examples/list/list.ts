import ollama from '../../src/browser'

await ollama.pull({
    model: 'llama2',
  })

await ollama.chat({
  model: 'llama2',
  messages: [{ role: 'user', content: 'True or false' }],
})

var response = await ollama.list()
console.log(response)

response = await ollama.ps()
console.log(response)