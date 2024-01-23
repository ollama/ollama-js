import ollama from 'ollama'

const prefix = `def remove_non_ascii(s: str) -> str:
"""
`
const suffix = `
return result
`
const response = await ollama.generate({
  model: 'codellama:7b-code',
  prompt: `<PRE> ${prefix} <SUF>${suffix} <MID>`,
  options: {
    num_predict: 128,
    temperature: 0,
    top_p: 0.9,
    presence_penalty: 0,
    stop: ['<EOT>'],
  },
})
console.log(response.response)
