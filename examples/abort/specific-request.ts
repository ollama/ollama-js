import ollama, { AbortableAsyncIterator } from '../../src'

let stream: AbortableAsyncIterator<object>

// Set a timeout to abort the request after 1 second
setTimeout(() => {
  console.log('\nAborting request...\n')
  stream.abort()
  // Note: This will error if Ollama doesn't start responding within 1 second!
}, 1000) // 1000 milliseconds = 1 second

ollama.generate({
    model: 'llama3.1',
    prompt: 'Write a long story',
    stream: true,
  }).then(
    async (_stream) => {
      stream = _stream
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
