# Ollama JavaScript Library
The Ollama JavaScript library provides the easiest way to integrate your JavaScript project with [Ollama](https://github.com/jmorganca/ollama).

## Getting Started

```
npm i ollama
```

## Usage
A global default client is provided for convenience and can be used for both single and streaming responses.

```javascript
import ollama from "ollama"

const response = await ollama.chat({model: 'llama2', messages: [{ role: 'user', content: 'Why is the sky blue?' }]})
console.log(response.message.content)
```

```javascript
import ollama from "ollama"

const message = { role: 'user', content: 'Why is the sky blue?' }
const response = await ollama.chat({model: 'llama2', messages: [message], stream: true})
for await (const part of response) {
  process.stdout.write(part.message.content)
}
```

## API

The API aims to mirror the [HTTP API for Ollama](https://github.com/jmorganca/ollama/blob/main/docs/api.md).

### Ollama

```javascript
new Ollama(config)
```

- `config` `<Object>` (Optional) Configuration object for Ollama.
  - `host` `<string>` (Optional) The Ollama host address. Default: `"http://127.0.0.1:11434"`.
  - `fetch` `<fetch>` (Optional) The fetch library used to make requests to the Ollama host.

### chat
```javascript
ollama.chat(request)
```

- `request` `<Object>`: The request object containing chat parameters.
  - `model` `<string>` The name of the model to use for the chat.
  - `messages` `<Message[]>`: Array of message objects representing the chat history.
      - `role` `<string>`: The role of the message sender ('user', 'system', or 'assistant').
      - `content` `<string>`: The content of the message.
      - `images` `<Uint8Array[] | string[]>`: (Optional) Images to be included in the message, either as Uint8Array or base64 encoded strings.
  - `format` `<string>`: (Optional) Set the expected format of the response (`json`).
  - `options` `<Options>`: (Optional) Options to configure the runtime.
  - `stream` `<boolean>`: (Optional) When true an `AsyncGenerator` is returned.

- Returns: `<ChatResponse>`

### generate
```javascript
ollama.generate(request)
```

- `request` `<Object>`: The request object containing generate parameters.
  - `model` `<string>` The name of the model to use for the chat.
  - `prompt` `<string>`: The prompt to send to the model.
  - `system` `<string>`: (Optional) Override the model system prompt.
  - `template` `<string>`: (Optional) Override the model template.
  - `raw` `<boolean>`: (Optional) Bypass the prompt template and pass the prompt directly to the model.
  - `images` `<Uint8Array[] | string[]>`: (Optional) Images to be included, either as Uint8Array or base64 encoded strings.
  - `format` `<string>`: (Optional) Set the expected format of the response (`json`).
  - `options` `<Options>`: (Optional) Options to configure the runtime.
  - `stream` `<boolean>`: (Optional) When true an `AsyncGenerator` is returned.
  
- Returns: `<GenerateResponse>`

### pull

```javascript
ollama.pull(request)
```

- `request` `<Object>`: The request object containing pull parameters.
  - `model` `<string>` The name of the model to pull.
  - `insecure` `<boolean>`: (Optional) Pull from servers whose identity cannot be verified.
  - `username` `<string>`: (Optional) Username of the user pulling the model.
  - `password` `<string>`: (Optional) Password of the user pulling the model.
  - `stream` `<boolean>`: (Optional) When true an `AsyncGenerator` is returned.
  
- Returns: `<ProgressResponse>`

### push

```javascript
ollama.push(request)
```

- `request` `<Object>`: The request object containing push parameters.
  - `model` `<string>` The name of the model to push.
  - `insecure` `<boolean>`: (Optional) Push to servers whose identity cannot be verified.
  - `username` `<string>`: (Optional) Username of the user pushing the model.
  - `password` `<string>`: (Optional) Password of the user pushing the model.
  - `stream` `<boolean>`: (Optional) When true an `AsyncGenerator` is returned.
  
- Returns: `<ProgressResponse>`

### create

```javascript
ollama.create(request)
```

- `request` `<Object>`: The request object containing create parameters.
  - `model` `<string>` The name of the model to create.
  - `path` `<string>`: (Optional) The path to the Modelfile of the model to create.
  - `modelfile` `<string>`: (Optional) The content of the Modelfile to create.
  - `stream` `<boolean>`: (Optional) When true an `AsyncGenerator` is returned.
  
- Returns: `<ProgressResponse>`

### delete

```javascript
ollama.delete(request)
```

- `request` `<Object>`: The request object containing delete parameters.
  - `model` `<string>` The name of the model to delete.
  
- Returns: `<StatusResponse>`

### copy

```javascript
ollama.copy(request)
```

- `request` `<Object>`: The request object containing copy parameters.
  - `source` `<string>` The name of the model to copy from.
  - `destination` `<string>` The name of the model to copy to.
  
- Returns: `<StatusResponse>`

### list

```javascript
ollama.list()
```
  
- Returns: `<ListResponse>`

### show

```javascript
ollama.show(request)
```

- `request` `<Object>`: The request object containing show parameters.
  - `model` `<string>` The name of the model to show.
  - `system` `<string>`: (Optional) Override the model system prompt returned.
  - `template` `<string>`: (Optional) Override the model template returned.
  - `options` `<Options>`: (Optional) Options to configure the runtime.
  
- Returns: `<ShowResponse>`

### embeddings

```javascript
ollama.embeddings(request)
```

- `request` `<Object>`: The request object containing embedding parameters.
  - `model` `<string>` The name of the model used to generate the embeddings.
  - `prompt` `<string>`: The prompt used to generate the embedding.
  - `options` `<Options>`: (Optional) Options to configure the runtime.
  
- Returns: `<EmbeddingsResponse>`

## Building

To build the project files run:

```sh
npm run build
```
