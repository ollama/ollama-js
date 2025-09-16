import 'dotenv/config'
import { Ollama } from 'ollama'

async function main() {
  const client = new Ollama({
    webSearchHost: 'https://ollama.com',
    headers: {
        ...(process.env.OLLAMA_API_KEY && { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` })
      }
  })

  const response = await client.search({
    queries: ['test search query'],
    maxResults: 1,
  })
  console.log(JSON.stringify(response, null, 2))
}

main().catch(console.error)
