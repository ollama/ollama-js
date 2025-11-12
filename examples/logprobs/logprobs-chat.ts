import { Ollama } from 'ollama';

function printLogprobs(entries: Array<{ token: string; logprob: number; top_logprobs?: typeof entries }>, label: string) {
  console.log(`\n${label}:`)
  for (const entry of entries) {
    console.log(`  token=${entry.token.padEnd(12)} logprob=${entry.logprob.toFixed(3)}`)
    for (const alt of entry.top_logprobs ?? []) {
      console.log(`    alt -> ${alt.token.padEnd(12)} (${alt.logprob.toFixed(3)})`)
    }
  }
}

async function main() {
  const client = new Ollama()
  console.log(`Using model: gemma3`)

  const chatResponse = await client.chat({
    model: 'gemma3',
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    logprobs: true,
    top_logprobs: 3,
  })
  console.log('Chat response:', chatResponse.message.content)
  printLogprobs(chatResponse.logprobs ?? [], 'chat logprobs')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

