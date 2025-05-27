import ollama from 'ollama'

async function main() {
  const response = await ollama.chat({
    model: 'deepseek-r1',
    messages: [
      {
        role: 'user',
        content: 'What is 10 + 23',
      },
    ],
    stream: true,
    think: true,
  })

  let startedThinking = false
  let finishedThinking = false

  for await (const chunk of response) {
    if (chunk.message.thinking && !startedThinking) {
      startedThinking = true
      process.stdout.write('Thinking:\n========\n\n')
    } else if (chunk.message.content && startedThinking && !finishedThinking) {
      finishedThinking = true
      process.stdout.write('\n\nResponse:\n========\n\n')
    }

    if (chunk.message.thinking) {
      process.stdout.write(chunk.message.thinking)
    } else if (chunk.message.content) {
      process.stdout.write(chunk.message.content)
    }
  }
}

main()
