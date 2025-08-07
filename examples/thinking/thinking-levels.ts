import ollama from 'ollama'

function printHeading(text: string) {
  console.log(text)
  console.log('='.repeat(text.length))
}

async function main() {
  const messages = [{ role: 'user', content: 'What is 10 + 23?' }]

  // gpt-oss supports 'low', 'medium', 'high'
  const thinkingLevels = ['low', 'medium', 'high'] as const

  for (const [index, level] of thinkingLevels.entries()) {
    const response = await ollama.chat({
      model: 'gpt-oss:20b',
      messages,
      think: level,
    })

    printHeading(`Thinking (${level})`)
    console.log(response.message.thinking ?? '')
    console.log('\n')

    printHeading('Response')
    console.log(response.message.content)
    console.log('\n')

    if (index < thinkingLevels.length - 1) {
      console.log('-'.repeat(20))
      console.log('\n')
    }
  }
}

main()
