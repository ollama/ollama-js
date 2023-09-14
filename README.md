# ollama
Interface with an ollama instance over HTTP.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [Ollama](#Ollama)
  - [generate](#generate)
  - [create](#create)
  - [tags](#tags)
  - [copy](#copy)
  - [delete](#delete)
  - [pull](#pull)
  - [embeddings](#embeddings)
- [Building](#building)
- [Testing](#testing)

## Install

```
npm i ollama
```

## Usage

```javascript
import { Ollama } from "ollama";

const ollama = new Ollama();

for await (const token of ollama.generate("llama2", "What is a llama?")) {
	process.stdout.write(token);
}
```

## API

The API aims to mirror the [HTTP API for Ollama](https://github.com/jmorganca/ollama/blob/main/docs/api.md).

### Ollama

```javascript
new Ollama(config);
```

- `config` `<Object>` The configuration object for Ollama.
  - `address` `<string>` The Ollama API address. Default: `"http://localhost:11434"`.

Create a new API handler for ollama.

### generate

```javascript
ollama.generate(model, prompt, [options]);
```

- `model` `<string>` The name of the model to use for the prompt.
- `prompt` `<string>` The prompt to give the model.
- `options` `<GenerateOptions>` Optional options to pass to the model.
  - `parameters` `<ModelParameters>` Model Parameters.
  - `context` `<number[]>` Context returned from previous calls.
  - `template` `<string>` Override the default template.
  - `system` `<string>` Override the default system string.
- Returns: `<AsyncGenerator<string, GenerateResult>>` A generator that outputs the tokens as strings.

Generate a response for a given prompt with a provided model. The final response object will include statistics and additional data from the request.

### create

```javascript
ollama.create(name, path);
```

- `name` `<string>` The name of the model.
- `path` `<string>` The path to the Modelfile.
- Returns: `AsyncGenerator<CreateStatus>` A generator that outputs the status of creation.

Create a model from a Modelfile.

### tags

```javascript
ollama.tags();
```

- Returns: `Promise<Tag[]>` A list of tags.

List models that are available locally.

### copy

```javascript
ollama.copy(source, destination);
```

- `source` `<string>` The name of the model to copy.
- `destination` `<string>` The name of copied model.
- Returns: `Promise<void>`

Copy a model. Creates a model with another name from an existing model.

### delete

```javascript
ollama.delete(model);
```

- `model` `<string>` The name of the model to delete.
- Returns: `Promise<void>`

Delete a model and its data.

### pull

```javascript
ollama.pull(name);
```

- `name` `<string>` The name of the model to download.
- Returns: `AsyncGenerator<PullResult>` A generator that outputs the status of the download.

Download a model from a the model registry. Cancelled pulls are resumed from where they left off, and multiple calls to will share the same download progress.

### embeddings

```javascript
ollama.embeddings(model, prompt, [parameters]);
```

- `model` `<string>` The name of the model to generate embeddings for.
- `prompt` `<string>` The prompt to generate embeddings with.
- `parameters` `<ModelParameters>` Model Parameters.
- Returns: `Promise<number[]>` The embeddings.

Generate embeddings from a model.

## Building

To build the project files run:

```sh
npm run build
```

## Testing

To lint files:

```sh
npm run lint
```
