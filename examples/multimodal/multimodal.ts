import https from 'https'
import ollama from 'ollama'

const imagePath = './examples/multimodal/cat.jpg'
const response = await ollama.generate({
  model: 'llava',
  prompt: 'describe this image:',
  images: [imagePath],
  stream: true,
})
for await (const part of response) {
  process.stdout.write(part.response)
}
