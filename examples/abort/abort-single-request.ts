import { Ollama } from 'ollama'

async function main() {
  const client1 = new Ollama()
  const client2 = new Ollama()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.all([
      (async () => {
        const stream = await client1.generate({
          model: 'llama3.2',
          prompt: 'Write a long story about dragons',
          stream: true,
        })
        // Start the timer once there is a stream to abort, even after a cold load.
        timer = setTimeout(() => {
          console.log('\nAborting dragons story...\n')
          client1.abort()
        }, 5000)
        try {
          for await (const chunk of stream) {
            process.stdout.write(' 1> ' + (chunk.response ?? ''))
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('\nDragons story request has been aborted')
          } else {
            throw error
          }
        }
      })(),
      (async () => {
        const stream = await client2.generate({
          model: 'llama3.2',
          prompt: 'Write a short story about wizards',
          stream: true,
        })
        for await (const chunk of stream) {
          process.stdout.write(' 2> ' + (chunk.response ?? ''))
        }
      })(),
    ])
  } finally {
    clearTimeout(timer)
    client1.abort()
    client2.abort()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
