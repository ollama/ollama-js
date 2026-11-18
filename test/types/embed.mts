import ollama from 'ollama'
import browser from 'ollama/browser'

const model = 'embeddinggemma2'
const image = 'aW1hZ2U='
const audio = 'YXVkaW8='

ollama.embed({ model, input: 'a cat' })
ollama.embed({ model, input: ['a cat', 'a dog'] })
ollama.embed({ model, input: { text: 'a cat', image } })
browser.embed({ model, input: ['a cat', { text: 'a dog' }, { image }, { audio }] })

// @ts-expect-error An object must contain text, image, or audio.
ollama.embed({ model, input: {} })
// @ts-expect-error Media must be a base64 string.
ollama.embed({ model, input: { text: 'a cat', image: new Uint8Array(1) } })
// @ts-expect-error The embed endpoint does not accept video.
browser.embed({ model, input: [{ video: 'dmlkZW8=' }] })
