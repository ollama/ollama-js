import { Ollama } from '../../src/index'

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

  const generateResponse = await client.generate({
    model: 'gemma3',
    prompt: 'Say hello in one short sentence.',
    logprobs: true,
    top_logprobs: 3,
  })
  console.log('Generate response:', generateResponse.response)
  printLogprobs(generateResponse.logprobs ?? [], 'generate logprobs')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

