import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'

async function main() {
  const API_KEY = process.env.OLLAMA_API_KEY || ''
  const MODEL = process.env.OLLAMA_MODEL || 'gpt-oss'

  const client = new Ollama({
    headers: { Authorization: `Bearer ${API_KEY}` },
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
      if (!API_KEY) throw new Error('Set OLLAMA_API_KEY to use websearch tool')
      return await client.search(args)
    },
    webcrawl: async (args: { urls: string[] }) => {
      if (!API_KEY) throw new Error('Set OLLAMA_API_KEY to use webcrawl tool')
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

  const response = await ollama.chat({
    model: MODEL,
    messages: messages,
    tools: [websearchTool, webcrawlTool],
    stream: true,
    think: true,
  })

  for await (const chunk of response) {
    if (chunk.message.thinking) {
      process.stdout.write(chunk.message.thinking)
    }
    if (chunk.message.content) {
      process.stdout.write(chunk.message.content)
    }
    if (chunk.message.tool_calls) {
      for (const toolCall of chunk.message.tool_calls) {
        const functionToCall = availableTools[toolCall.function.name]
        if (functionToCall) {
          const rawArgs = toolCall.function.arguments as any
          const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs
          console.log('\nCalling function:', toolCall.function.name, 'with arguments:', parsedArgs)
          const output = await functionToCall(parsedArgs)
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

  console.log('----- Sending result back to model \n')

  if (messages.some((msg) => msg.role === 'tool')) {
    const finalResponse = await ollama.chat({
      model: MODEL,
      messages: messages,
      tools: [websearchTool, webcrawlTool],
      stream: true,
      think: true,
    })

    let doneThinking = false
    for await (const chunk of finalResponse) {
      if (chunk.message.thinking) {
        process.stdout.write(chunk.message.thinking)
      }
      if (chunk.message.content) {
        if (!doneThinking) {
          console.log('\n----- Final result:')
          doneThinking = true
        }
        process.stdout.write(chunk.message.content)
      }
      if (chunk.message.tool_calls) {
        console.log('Model returned tool calls:')
        console.log(chunk.message.tool_calls)
      }
    }
    process.stdout.write('\n')
  } else {
    console.log('No tool calls returned')
  }
}

main().catch(console.error)