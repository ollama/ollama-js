import 'dotenv/config'
import { Ollama } from 'ollama'

async function main() {
  const client = new Ollama({
    webSearchHost: 'https://ollama.com',
    headers: {
        ...(process.env.OLLAMA_API_KEY && { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` })
      }
  })

  const response = await client.crawl({
    urls: ['https://katalon.com/resources-center/blog/test-cases-for-search-functionality'],
    text: true,
    livecrawl: 'fallback'
  })
  console.log(JSON.stringify(response, null, 2))
}

main().catch(console.error)


