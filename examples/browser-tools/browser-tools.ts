import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'
import { Browser } from './browser-tool-helpers'

async function main() {
  if (!process.env.OLLAMA_API_KEY) {
    throw new Error('Set OLLAMA_API_KEY to use browser tools')
  }

  const client = new Ollama({
    headers: process.env.OLLAMA_API_KEY
      ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
      : undefined,
  })

  const browser = new Browser(undefined, client)

  // Tool schemas for the model
  const browserSearchTool = {
    type: 'function',
    function: {
      name: 'browser.search',
      description: 'Search the web for information and display results',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          topn: {
            type: 'number',
            description: 'Number of top results to return (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  }

  const browserOpenTool = {
    type: 'function',
    function: {
      name: 'browser.open',
      description: 'Open a link in the browser or display a page',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: ['string', 'number'],
            description: 'URL to open (string) or Link ID from current page (number)',
          },
          cursor: {
            type: 'number',
            description: 'Page cursor to use (default: current page)',
          },
          loc: {
            type: 'number',
            description: 'Line location to start viewing from (default: 0)',
          },
          num_lines: {
            type: 'number',
            description: 'Number of lines to display (default: auto based on tokens)',
          },
        },
      },
    },
  }

  const browserFindTool = {
    type: 'function',
    function: {
      name: 'browser.find',
      description: 'Find a text pattern within the current browser page',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The text pattern to search for',
          },
          cursor: {
            type: 'number',
            description: 'Page cursor to search in (default: current page)',
          },
        },
        required: ['pattern'],
      },
    },
  }

  // Available tool functions
  const availableTools = {
    'browser.search': async (args: { query: string; topn?: number }) => {
      const result = await browser.search(args)
      return result.pageText
    },
    'browser.open': async (args: {
      id?: string | number
      cursor?: number
      loc?: number
      num_lines?: number
    }) => {
      const result = await browser.open(args)
      return result.pageText
    },
    'browser.find': async (args: { pattern: string; cursor?: number }) => {
      const result = await browser.find(args)
      return result.pageText
    },
  }

  const messages: Message[] = [
    {
      role: 'user',
      content: 'Who is Nicole Pardal?',
    },
  ]

  console.log('----- Prompt:', messages.find((m) => m.role === 'user')?.content, '\n')

  while (true) {
    const response = await client.chat({
      model: 'gpt-oss',
      messages: messages,
      tools: [browserSearchTool, browserOpenTool, browserFindTool],
      stream: true,
      think: true,
    })

    let hadToolCalls = false
    let startedThinking = false
    let finishedThinking = false
    let content = ''
    let thinking = ''

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
        messages.push({
          role: 'assistant',
          content: content,
          thinking: thinking,
        })

        hadToolCalls = true
        for (const toolCall of chunk.message.tool_calls) {
          const functionToCall =
            availableTools[toolCall.function.name as keyof typeof availableTools]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            const output = await functionToCall(args)

            // message history
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
      break
    }
  }
}

main().catch(console.error)
