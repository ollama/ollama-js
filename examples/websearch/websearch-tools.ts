import { Ollama, type Message, type SearchResponse, type FetchResponse } from 'ollama'

async function main() {

  if (!process.env.OLLAMA_API_KEY) throw new Error('Set OLLAMA_API_KEY to use web search tools')

  const client = new Ollama({
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  })

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
            description: 'The maximum number of results to return per query (default 5, max 10).',
          },
        },
        required: ['query'],
      },
    },
  }

  const webCrawlTool = {
    type: 'function',
    function: {
      name: 'webCrawl',
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
		webSearch: async (args: { query: string; max_results?: number }): Promise<SearchResponse> => {
			const res = await client.webSearch(args)
			return res as SearchResponse
		},
		webCrawl: async (args: { url: string }): Promise<FetchResponse> => {
			const res = await client.webCrawl(args)
			return res as FetchResponse
		},
	}

  const messages: Message[] = [
    {
      role: 'user',
      content: 'What is Ollama?',
    },
  ]

  console.log('----- Prompt:', messages.find((m) => m.role === 'user')?.content, '\n')

  while (true) {
	const response = await client.chat({
      model: 'qwen3',
      messages: messages,
      tools: [webSearchTool, webCrawlTool],
      stream: true,
      think: true,
    })

    let hadToolCalls = false
    let startedThinking = false
    let finishedThinking = false
    var content = ''
    var thinking = ''
    for await (const chunk of response) {
      if (chunk.message.thinking && !startedThinking) {
        startedThinking = true
        process.stdout.write('Thinking:\n========\n\n')
      } else if (chunk.message.content && startedThinking && !finishedThinking) {
        finishedThinking = true
        process.stdout.write('\n\nResponse:\n========\n\n')
      }

      if (chunk.message.thinking) {
        thinking += chunk.message.thinking
        process.stdout.write(chunk.message.thinking)
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
            console.log('\nCalling function:', toolCall.function.name, 'with arguments:', args)
            const output = await functionToCall(args)
            console.log('Function output:', JSON.stringify(output).slice(0, 200), '\n')
            
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