import {
  Ollama,
  type Message,
  type WebSearchResponse,
  type WebFetchResponse,
} from 'ollama'

async function main() {
  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) {
    throw new Error(
      'Set OLLAMA_API_KEY to an API key from https://ollama.com/settings/keys',
    )
  }
  const client = new Ollama()

  // Tool schemas
  const webSearchTool = {
    type: 'function',
    function: {
      name: 'webSearch',
      description: 'Performs a web search for the given query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string.' },
          max_results: {
            type: 'number',
            description: 'The maximum number of results to return per query (default 3).',
          },
        },
        required: ['query'],
      },
    },
  }

  const webFetchTool = {
    type: 'function',
    function: {
      name: 'webFetch',
      description: 'Fetches a single page by URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'A single URL to fetch.' },
        },
        required: ['url'],
      },
    },
  }

  const availableTools = {
    webSearch: async (args: {
      query: string
      max_results?: number
    }): Promise<WebSearchResponse> => {
      const res = await client.webSearch(args)
      return res as WebSearchResponse
    },
    webFetch: async (args: { url: string }): Promise<WebFetchResponse> => {
      const res = await client.webFetch(args)
      return res as WebFetchResponse
    },
  }

  const query = 'What is Ollama?'
  console.log('Prompt:', query, '\n')

  const messages: Message[] = [
    {
      role: 'user',
      content: query,
    },
  ]

  while (true) {
    const response = await client.chat({
      model: 'qwen3',
      messages: messages,
      tools: [webSearchTool, webFetchTool],
      stream: true,
      think: true,
    })

    const assistant: Message = {
      role: 'assistant',
      content: '',
      thinking: '',
      tool_calls: [],
    }
    for await (const chunk of response) {
      assistant.thinking += chunk.message.thinking ?? ''
      assistant.content += chunk.message.content ?? ''
      assistant.tool_calls!.push(...(chunk.message.tool_calls ?? []))
      process.stdout.write(chunk.message.content ?? '')
    }

    messages.push(assistant)
    if (!assistant.tool_calls?.length) {
      process.stdout.write('\n')
      break
    }

    for (const toolCall of assistant.tool_calls) {
      const functionToCall = availableTools[toolCall.function.name]
      let output
      try {
        output = functionToCall
          ? await functionToCall(toolCall.function.arguments as any)
          : { error: `Unknown tool: ${toolCall.function.name}` }
      } catch (error) {
        output = { error: error instanceof Error ? error.message : String(error) }
      }
      messages.push({
        role: 'tool',
        content: JSON.stringify(output).slice(0, 2000 * 4),
        tool_name: toolCall.function.name,
      })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
