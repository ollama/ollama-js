import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'

async function main() {
  const MODEL = process.env.OLLAMA_MODEL || 'gpt-oss'

  if (!process.env.OLLAMA_API_KEY) throw new Error('Set OLLAMA_API_KEY to use websearch tools')

  const client = new Ollama({
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  })

  // Tool schemas
  const websearchTool = {
    type: 'function',
    function: {
      name: 'websearch',
      description: 'Performs a web search for the given queries.',
      parameters: {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            items: { type: 'string' },
            description: 'An array of search queries.',
          },
          maxResults: {
            type: 'number',
            description: 'The maximum number of results to return per query (default 5, max 10).',
          },
        },
        required: ['queries'],
      },
    },
  }

  const webcrawlTool = {
    type: 'function',
    function: {
      name: 'webcrawl',
      description: 'Performs a web crawl for the given URLs.',
      parameters: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'An array of URLs to crawl.',
          },
        },
        required: ['urls'],
      },
    },
  }

  const availableTools = {
    websearch: async (args: { queries: string[]; maxResults?: number }) => {
      return await client.search(args)
    },
    webcrawl: async (args: { urls: string[] }) => {
      return await client.crawl(args)
    },
  }

  const messages: Message[] = [
    {
      role: 'system',
      content: 'Answer in natural language. Use tools if helpful. Do not output JSON unless explicitly asked.',
    },
    {
      role: 'user',
      content: 'What is Ollama?',
    },
  ]

  console.log('----- Prompt:', messages.find((m) => m.role === 'user')?.content, '\n')

  while (true) {
    const response = await ollama.chat({
      model: MODEL,
      messages: messages,
      tools: [websearchTool, webcrawlTool],
      stream: true,
      think: true,
    })

    let hadToolCalls = false
    for await (const chunk of response) {
      if (chunk.message.thinking) {
        process.stdout.write(chunk.message.thinking)
      }
      if (chunk.message.content) {
        process.stdout.write(chunk.message.content)
      }
      if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
        hadToolCalls = true
        for (const toolCall of chunk.message.tool_calls) {
          const functionToCall = availableTools[toolCall.function.name]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            console.log('\nCalling function:', toolCall.function.name, 'with arguments:', args)
            const output = await functionToCall(args)
            console.log('> Function output:', JSON.stringify(output), '\n')

            messages.push(chunk.message)
            messages.push({
              role: 'tool',
              content: JSON.stringify(output),
              tool_name: toolCall.function.name,
            })
          }
        }
      }
    }

    if (!hadToolCalls) {
      process.stdout.write('\n')
      break
    }

    console.log('----- Sending result back to model \n')
  }
}

main().catch(console.error)