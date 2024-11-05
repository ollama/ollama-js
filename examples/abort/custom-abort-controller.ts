import ollama from 'ollama'

const abortController = new AbortController()

// Set a timeout to abort the request after 100 milliseconds before the stream starts
setTimeout(() => {
  console.log('\nAborting request...\n')
  abortController.abort()
}, 100) // 100 milliseconds


ollama.generate({
    model: 'llama3.1',
    prompt: 'Write a long story',
    stream: true, // this could be a non-streamable request
    abortController
  }).then(
    async (stream) => {
      for await (const chunk of stream) {
        process.stdout.write(chunk.response)
      }
    }
  ).catch(
    (error) => {
      if (error.name === 'AbortError') {
        console.log('The request has been aborted')
      } else {
        console.error('An error occurred:', error)
      }
    }
  )
