import ollama, { type Message } from 'ollama'

// Add two numbers function
function addTwoNumbers(args: { a: number; b: number }): number {
  return Number(args.a) + Number(args.b)
}

// Subtract two numbers function
function subtractTwoNumbers(args: { a: number; b: number }): number {
  return Number(args.a) - Number(args.b)
}

// Tool definition for add function
const addTwoNumbersTool = {
  type: 'function',
  function: {
    name: 'addTwoNumbers',
    description: 'Add two numbers together',
    parameters: {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: { type: 'number', description: 'The first number' },
        b: { type: 'number', description: 'The second number' },
      },
    },
  },
}

// Tool definition for subtract function
const subtractTwoNumbersTool = {
  type: 'function',
  function: {
    name: 'subtractTwoNumbers',
    description: 'Subtract two numbers',
    parameters: {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: { type: 'number', description: 'The first number' },
        b: { type: 'number', description: 'The second number' },
      },
    },
  },
}

async function run(model: string) {
  const messages: Message[] = [{ role: 'user', content: 'What is three minus one?' }]
  console.log('Prompt:', messages[0].content)

  const availableFunctions = {
    addTwoNumbers: addTwoNumbers,
    subtractTwoNumbers: subtractTwoNumbers,
  }

  const response = await ollama.chat({
    model: model,
    messages: messages,
    tools: [addTwoNumbersTool, subtractTwoNumbersTool],
  })

  if (response.message.tool_calls?.length) {
    messages.push(response.message)
    // Process tool calls from the response
    for (const tool of response.message.tool_calls) {
      const functionToCall = availableFunctions[tool.function.name]
      if (functionToCall) {
        console.log('Calling function:', tool.function.name)
        console.log('Arguments:', tool.function.arguments)
        const output = functionToCall(tool.function.arguments as { a: number; b: number })
        console.log('Function output:', output)

        // Add the function response to messages for the model to use
        messages.push({
          role: 'tool',
          content: output.toString(),
          tool_name: tool.function.name,
        })
      } else {
        messages.push({
          role: 'tool',
          content: `Unknown tool: ${tool.function.name}`,
          tool_name: tool.function.name,
        })
      }
    }

    // Get final response from model with function outputs
    const finalResponse = await ollama.chat({
      model: model,
      messages: messages,
    })
    console.log('Final response:', finalResponse.message.content)
  } else {
    console.log('No tool calls returned from model')
  }
}

run('llama3.1:8b').catch((error) => console.error('An error occurred:', error))
