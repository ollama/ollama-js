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
    stream: false,
    think: true,
  })

  console.log('Thinking:\n========\n\n' + response.message.thinking)
  console.log('\nResponse:\n========\n\n' + response.message.content + '\n\n')
}

main()
