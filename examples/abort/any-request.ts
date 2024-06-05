import ollama from 'ollama'

// Set a timeout to abort the request after 1 second
setTimeout(() => {
  console.log('\nAborting request...\n')
  ollama.abort()
}, 1000) // 1000 milliseconds = 1 second

try {
  ollama.generate({
    model: 'llama2',
    prompt: 'Write a long story',
    stream: true,
  }).then(
    async (stream) => {
      for await (const chunk of stream) {
        process.stdout.write(chunk.response)
      }
    }
  )
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('The request has been aborted')
  } else {
    console.error('An error occurred:', error)
  }
}
