import { Ollama } from 'ollama'

// Create multiple ollama clients
const client1 = new Ollama()
const client2 = new Ollama()

// Set a timeout to abort just the first request after 1 second
setTimeout(() => {
  console.log('\nAborting dragons story...\n')
  // abort the first client
  client1.abort()
}, 1000) // 1000 milliseconds = 1 second

// Start multiple concurrent streaming requests with different clients
Promise.all([
  client1.generate({
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

  client2.generate({
    model: 'llama3.2', 
    prompt: 'Write a short story about wizards',
    stream: true,
  }).then(
    async (stream) => {
      console.log(' Starting stream for wizards story...')
      for await (const chunk of stream) {
        process.stdout.write(' 2> ' + chunk.response)
      }
    }
  ),

]).catch(error => {
  if (error.name === 'AbortError') {
    console.log('Dragons story request has been aborted')
  } else {
    console.error('An error occurred:', error)
  }
})


