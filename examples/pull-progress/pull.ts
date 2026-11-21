import ollama from 'ollama'

async function main() {
  const model = 'llama3.1'
  console.log(`downloading ${model}...`)
  const completedDigests = new Set<string>()
  const stream = await ollama.pull({ model: model, stream: true })
  for await (const part of stream) {
    if (!part.digest) {
      console.log(part.status)
      continue
    }
    if (completedDigests.has(part.digest)) {
      continue
    }

    const percent = part.total
      ? Math.min(100, Math.floor(((part.completed ?? 0) / part.total) * 100))
      : 0
    const progress = `${part.status} ${percent}%...`
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
    }
    if (percent === 100) {
      completedDigests.add(part.digest)
      console.log(progress)
    } else if (process.stdout.isTTY) {
      process.stdout.write(progress)
    }
  }
}

main().catch(console.error)
