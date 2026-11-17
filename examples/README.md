# Running examples

Run commands from the repository root with Node.js 20 or later and a running [Ollama](https://ollama.com/download) server:

```sh
npm install
npm run build
npm install --no-save --package-lock=false tsx 'zod@^4' @types/node
npx tsx examples/tools/calculator.ts
```

The examples import `ollama` from this checkout's built `dist` directory. Rebuild after changing the SDK. `tsx` runs TypeScript; the structured-output examples use Zod 4. To use a released SDK in another project, install `ollama>=0.6.4` instead. System One is available in 0.6.4; System One image inputs currently require `main` and a rebuilt package.

Pull the model named in the example before running it, for example `ollama pull gemma4`. Use `ollama list` to see installed models and `ollama show <model>` to check capabilities. Models may require several GB of memory and disk space; pulling is a separate step except in the pull-progress example.

| Examples | Model / additional requirements |
| --- | --- |
| [Calculator](tools/calculator.ts), [structured text output](structured_outputs/structured-outputs.ts) | `gemma4` |
| [Flight tracker](tools/flight-tracker.ts) | `mistral`; flight data is simulated |
| [Multi-tool](tools/multi-tool.ts), [web search](websearch/websearch-tools.ts) | `qwen3` (thinking and tools); weather data is simulated |
| [GPT-OSS browser tools](websearch/gpt-oss-browser-tools.ts) | `gpt-oss`; web-search API key |
| [Thinking](thinking/thinking-enabled.ts), [streaming thinking](thinking/thinking-streaming.ts) | `deepseek-r1` |
| [Thinking levels](thinking/thinking-levels.ts) | `gpt-oss:20b` |
| [Fill in the middle](fill-in-middle/fill.ts) | `deepseek-coder-v2` |
| [Logprobs](logprobs/logprobs-chat.ts) | `gemma3` |
| [Multimodal](multimodal/multimodal.ts) | `gemma4`; includes `cat.jpg` |
| [Structured image output](structured_outputs/structured-outputs-image.ts) | `gemma4` and an image path |
| [Abort all](abort/abort-all-requests.ts), [abort one](abort/abort-single-request.ts) | `gemma4` |
| [Pull progress](pull-progress/pull.ts) | Downloads `gemma4` |
| [Image generation](image-generation/image-generation.ts) | `x/z-image-turbo`; supported macOS installation; overwrites `output.png` |
| [System One](systemone.mjs) | `nimble`; Ollama v0.35.0 or later; run with `node examples/systemone.mjs` |

Most examples use the local server at `http://localhost:11434`. Pass `host` to `new Ollama({ host: 'http://your-server:11434' })` to use another server. JavaScript does not automatically read `OLLAMA_HOST`; `systemone.mjs` explicitly reads it. For HTTPS requests to `ollama.com`, the SDK reads `OLLAMA_API_KEY` and adds a Bearer header unless one was supplied explicitly.

A connection error means the server is not reachable. A model-not-found error means you need to pull the exact tag on that server. Structured outputs require a local model; Ollama's cloud does not currently support the `format` schema.

## Web search and cloud inference

Create an [API key](https://ollama.com/settings/keys) and set `OLLAMA_API_KEY` before running either web-search example. The SDK adds it to search/fetch requests, which call `https://ollama.com` even when the model runs locally.

For direct cloud inference, create `new Ollama({ host: 'https://ollama.com' })` and use the direct model name, such as `gpt-oss:120b`. Through a local server, run `ollama signin`, pull `gpt-oss:120b-cloud`, and use that tag with the local host. See [cloud authentication](https://docs.ollama.com/cloud/api), [available models](https://ollama.com/search), and the [API documentation](https://docs.ollama.com/api/introduction).
