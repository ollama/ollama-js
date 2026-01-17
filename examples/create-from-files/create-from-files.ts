import ollama from 'ollama'
import path from 'node:path'

// download
//  - https://huggingface.co/ggml-org/tinygemma3-GGUF/blob/main/tinygemma3-Q8_0.gguf
//  - https://huggingface.co/ggml-org/tinygemma3-GGUF/blob/main/mmproj-tinygemma3.gguf

const GGUF_1 = path.join(__dirname, './tinygemma3-Q8_0.gguf')
const GGUF_2 = path.join(__dirname, './mmproj-tinygemma3.gguf')

async function main() {
  console.log('Example: Creating a model from local files\n')

  // Example 1: Create a model from a local GGUF file with modelfile
  console.log('Example 1: Creating model from local file with modelfile')
  try {
    const response = await ollama.create({
      model: 'custom-model',
      modelfile: `
FROM ${GGUF_1}
SYSTEM "You are mario from super mario bros."
PARAMETER temperature 0.7
`,
      files: [
        {
          filepath: GGUF_1,
          // sha256 is optional - will be computed automatically if not provided
        },
      ],
      stream: true,
    })

    for await (const progress of response) {
      console.log(`Progress: ${progress.status}`)
    }
    console.log('Model created successfully!\n')
  } catch (error) {
    console.error('Error creating model:', error)
  }

  // Example 2: Create a model from multiple files (e.g., base model + adapter)
  console.log('Example 2: Creating model from multiple files')
  try {
    const response = await ollama.create({
      model: 'fusion-model',
      modelfile: `FROM ${GGUF_1}`,
      files: [
        {
          filepath: GGUF_1,
        },
        {
          filepath: GGUF_2,
        },
      ],
      stream: false, // Non-streaming response
    })

    console.log(`Status: ${response.status}`)
    console.log('Model created successfully!\n')
  } catch (error) {
    console.error('Error creating model with multiple files:', error)
  }

  // Example 3: Create a model using the Ollama class directly (for more control)
  console.log('Example 3: Using Ollama class directly')
  try {
    const { Ollama } = await import('ollama')
    const ollamaClient = new Ollama({
      host: 'http://localhost:11434',
    })

    const response = await ollamaClient.create({
      model: 'nude-model',
      modelfile: `FROM ${GGUF_1}`,
      files: [
        {
          filepath: GGUF_1,
        },
      ],
      stream: false,
    })

    console.log(`Status: ${(response as any).status || 'completed'}`)
    console.log('Model created successfully!')
  } catch (error) {
    console.error('Error with direct client:', error)
  }
}

main().catch(console.error)
