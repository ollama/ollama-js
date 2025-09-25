import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'
import { Browser } from './gpt-oss-browser-tools-helpers'

async function main() {
  if (!process.env.OLLAMA_API_KEY) {
    throw new Error('Set OLLAMA_API_KEY to use browser tools')
  }

  const client = new Ollama({
    headers: process.env.OLLAMA_API_KEY
      ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
      : undefined,
  })

  const browser = new Browser(undefined, {
    search: (request) => client.webSearch(request as any),
    fetch: (request) => client.webFetch(request as any),
  })

  // Tool schemas for the model
  const browserSearchTool = {
    type: 'function',
    function: {
      name: 'websearch',
      description: 'Performs a web search for the given query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string.' },
          topn: { type: 'number', description: 'Max results to return (default 5).' },
        },
        required: ['query'],
      },
    },
  }

  const browserOpenTool = {
    type: 'function',
    function: {
      name: 'browser_open',
      description: 'Open a search result or URL, or scroll the current page.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            description: 'Link id (number) from the results page, or a URL string to open',
            anyOf: [{ type: 'number' }, { type: 'string' }],
          },
          cursor: { type: 'number', description: 'Page index in the stack to operate on' },
          loc: { type: 'number', description: 'Start line to view from' },
          num_lines: { type: 'number', description: 'Number of lines to display (-1 for auto)' },
        },
      },
    },
  }

  const browserFindTool = {
    type: 'function',
    function: {
      name: 'browser_find',
      description: 'Find a pattern within the currently open page.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text to search for in the page' },
          cursor: { type: 'number', description: 'Page index in the stack to search' },
        },
        required: ['pattern'],
      },
    },
  }

  const availableTools = {
    websearch: async (args: { query: string; topn?: number }) => {
      const result = await browser.search(args)
      return result.pageText
    },
    browser_open: async (args: {
      id?: string | number
      cursor?: number
      loc?: number
      num_lines?: number
    }) => {
      const result = await browser.open(args)
      return result.pageText
    },
    browser_find: async (args: { pattern: string; cursor?: number }) => {
      const result = await browser.find(args)
      return result.pageText
    },
  }

  const messages: Message[] = [
    {
      role: 'user',
      content: 'what is ollama new engine?',
    },
  ]

  console.log('Prompt:', messages.find((m) => m.role === 'user')?.content, '\n')

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
            availableTools[toolCall.function.name]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            console.log('\nCalling function:', toolCall.function.name, 'with arguments:', args)
            let output
            try {
              output = await functionToCall(args)
            } catch (error) {
              output = { error: error instanceof Error ? error.message : 'Unknown error' }
            }
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
      break
    }
  }
}

main().catch(console.error)
