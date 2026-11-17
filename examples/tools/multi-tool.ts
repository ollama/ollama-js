import { Ollama, type Message } from 'ollama'

// Mock weather functions
function getTemperature(args: { city: string }): string {
  const validCities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney']

  if (!validCities.includes(args.city)) {
    return 'Unknown city'
  }

  return `${Math.floor(Math.random() * 36)} degrees Celsius`
}

function getConditions(args: { city: string }): string {
  const validCities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney']

  if (!validCities.includes(args.city)) {
    return 'Unknown city'
  }

  const conditions = ['sunny', 'cloudy', 'rainy', 'snowy']
  return conditions[Math.floor(Math.random() * conditions.length)]
}

// Tool definitions
const getTemperatureTool = {
  type: 'function',
  function: {
    name: 'getTemperature',
    description: 'Get the temperature for a city in Celsius',
    parameters: {
      type: 'object',
      required: ['city'],
      properties: {
        city: { type: 'string', description: 'The name of the city' },
      },
    },
  },
}

const getConditionsTool = {
  type: 'function',
  function: {
    name: 'getConditions',
    description: 'Get the weather conditions for a city',
    parameters: {
      type: 'object',
      required: ['city'],
      properties: {
        city: { type: 'string', description: 'The name of the city' },
      },
    },
  },
}

async function run(model: string) {
  const cities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney']
  const city = cities[Math.floor(Math.random() * cities.length)]
  const city2 = cities[Math.floor(Math.random() * cities.length)]

  const messages: Message[] = [
    {
      role: 'user',
      content: `What is the temperature in ${city}? and what are the weather conditions in ${city2}?`,
    },
  ]
  console.log('----- Prompt:', messages[0].content, '\n')

  const ollama = new Ollama()
  const availableFunctions = {
    getTemperature,
    getConditions,
  }

  while (true) {
    const response = await ollama.chat({
      model,
      messages,
      tools: [getTemperatureTool, getConditionsTool],
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
      process.stdout.write(chunk.message.thinking ?? '')
      process.stdout.write(chunk.message.content ?? '')
    }

    messages.push(assistant)
    if (!assistant.tool_calls?.length) {
      process.stdout.write('\n')
      break
    }
    for (const tool of assistant.tool_calls) {
      const functionToCall = availableFunctions[tool.function.name]
      const output = functionToCall
        ? functionToCall(tool.function.arguments as { city: string })
        : `Unknown tool: ${tool.function.name}`
      console.log('\nTool result:', output)
      messages.push({ role: 'tool', content: output, tool_name: tool.function.name })
    }
  }
}

run('qwen3').catch((error) => {
  console.error(error)
  process.exitCode = 1
})
