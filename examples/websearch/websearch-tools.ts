import {
  Ollama,
  type Message,
  type WebSearchResponse,
  type WebFetchResponse,
} from 'ollama'

async function main() {
  // Set enviornment variable OLLAMA_API_KEY=<YOUR>.<KEY>
  // or set the header manually
  //   const client = new Ollama({
  //     headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  //   })
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

    let hadToolCalls = false
    var content = ''
    var thinking = ''
    for await (const chunk of response) {
      if (chunk.message.thinking) {
        thinking += chunk.message.thinking
      }
      if (chunk.message.content) {
        content += chunk.message.content
        process.stdout.write(chunk.message.content)
      }
      if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
        hadToolCalls = true
        messages.push({
          role: 'assistant',
          content: content,
          thinking: thinking,
          tool_calls: chunk.message.tool_calls,
        })
        // Execute tools and append tool results
        for (const toolCall of chunk.message.tool_calls) {
          const functionToCall = availableTools[toolCall.function.name]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            console.log(
              '\nCalling function:',
              toolCall.function.name,
              'with arguments:',
              args,
            )
            const output = await functionToCall(args)
            console.log('Function result:', JSON.stringify(output).slice(0, 200), '\n')

            messages.push(chunk.message)
            messages.push({
              role: 'tool',
              content: JSON.stringify(output).slice(0, 2000 * 4), // cap at ~2000 tokens
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
  }
}

main().catch(console.error)
