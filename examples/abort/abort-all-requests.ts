import ollama from 'ollama'

async function main() {
  const prompts = [
    'Write a long story about dragons',
    'Write a long story about wizards',
    'Write a long story about knights',
  ]
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.all(
      prompts.map(async (prompt, index) => {
        const stream = await ollama.generate({ model: 'gemma4', prompt, stream: true })
        // Pending requests cannot be aborted until their response headers arrive.
        if (cancelled) {
          stream.abort()
          return
        }
        timer ??= setTimeout(() => {
          cancelled = true
          console.log('\nAborting all requests...\n')
          ollama.abort()
        }, 5000)
        try {
          for await (const chunk of stream) {
            process.stdout.write(` ${index + 1}> ${chunk.response ?? ''}`)
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`\nStream ${index + 1} aborted`)
          } else {
            throw error
          }
        }
      }),
    )
  } finally {
    cancelled = true
    clearTimeout(timer)
    ollama.abort()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
