import ollama from 'ollama'

// Set a timeout to abort all requests after 1 second
setTimeout(() => {
  console.log('\nAborting all requests...\n')
  ollama.abort()
}, 1000) // 1000 milliseconds = 1 second

// Start multiple concurrent streaming requests
Promise.all([
  ollama.generate({
    model: 'llama3.2',
    prompt: 'Write a long story about dragons',
    stream: true,
  }).then(
    async (stream) => {
      console.log(' Starting stream for dragons story...')
      for await (const chunk of stream) {
        process.stdout.write(' 1> ' + chunk.response)
      }
    }
  ),

  ollama.generate({
    model: 'llama3.2', 
    prompt: 'Write a long story about wizards',
    stream: true,
  }).then(
    async (stream) => {
      console.log(' Starting stream for wizards story...')
      for await (const chunk of stream) {
        process.stdout.write(' 2> ' + chunk.response)
      }
    }
  ),

  ollama.generate({
    model: 'llama3.2',
    prompt: 'Write a long story about knights',
    stream: true,
  }).then(
    async (stream) => {
      console.log(' Starting stream for knights story...')
      for await (const chunk of stream) {
        process.stdout.write(' 3>' + chunk.response)
      }
    }
  )
]).catch(error => {
  if (error.name === 'AbortError') {
    console.log('All requests have been aborted')
  } else {
    console.error('An error occurred:', error)
  }
})
