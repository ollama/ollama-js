import ollama from 'ollama'

const model = 'llama2'
console.log(`downloading ${model}...`)
let currentDigestDone = false
const stream = await ollama.pull({ model: model, stream: true })
for await (const part of stream) {
  if (part.digest) {
    let percent = 0
    if (part.completed && part.total) {
      percent = Math.round((part.completed / part.total) * 100)
    }
    process.stdout.clearLine(0) // Clear the current line
    process.stdout.cursorTo(0) // Move cursor to the beginning of the line
    process.stdout.write(`${part.status} ${percent}%...`) // Write the new text
    if (percent === 100 && !currentDigestDone) {
      console.log() // Output to a new line
      currentDigestDone = true
    } else {
      currentDigestDone = false
    }
  } else {
    console.log(part.status)
  }
}
