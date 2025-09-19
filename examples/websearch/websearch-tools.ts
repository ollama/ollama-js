import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'

async function main() {
<<<<<<< HEAD

  if (!process.env.OLLAMA_API_KEY) throw new Error('Set OLLAMA_API_KEY to use web search tools')
=======
  if (!process.env.OLLAMA_API_KEY) throw new Error('Set OLLAMA_API_KEY to use websearch tools')
>>>>>>> cf5953e (resolved merge conflicts)

  const client = new Ollama({
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  })

  // Tool schemas
  const webSearchTool = {
    type: 'function',
    function: {
      name: 'webSearch',
      description: 'Performs a web search for the given queries.',
      parameters: {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            items: { type: 'string' },
            description: 'An array of search queries.',
          },
          max_results: {
            type: 'number',
            description: 'The maximum number of results to return per query (default 5, max 10).',
          },
        },
        required: ['queries'],
      },
    },
  }

  const webCrawlTool = {
    type: 'function',
    function: {
      name: 'webCrawl',
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
<<<<<<< HEAD
    webSearch: async (args: { queries: string[]; max_results?: number }) => {
      return await client.webSearch(args)
    },
    webCrawl: async (args: { urls: string[] }) => {
      return await client.webCrawl(args)
=======
    websearch: async (args: { queries: string[]; max_results?: number }) => {
      return await client.websearch(args)
    },
    webcrawl: async (args: { urls: string[] }) => {
      return await client.webcrawl(args)
>>>>>>> cf5953e (resolved merge conflicts)
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
      model: 'gpt-oss',
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
<<<<<<< HEAD
        // Execute tools and append tool results
=======
>>>>>>> cf5953e (resolved merge conflicts)
        for (const toolCall of chunk.message.tool_calls) {
          const functionToCall = availableTools[toolCall.function.name]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            console.log('\nCalling function:', toolCall.function.name, 'with arguments:', args)
            const output = await functionToCall(args)
<<<<<<< HEAD
            console.log('Function output:', JSON.stringify(output).slice(0, 200), '\n')
            console.log('Function output:', JSON.stringify(output).slice(0, 200), '\n')
            
=======
            console.log('Function output:', JSON.stringify(output).slice(0, 200), '\n')
>>>>>>> cf5953e (resolved merge conflicts)
            messages.push(chunk.message)
            // tool result
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