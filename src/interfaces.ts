export type Fetch = typeof fetch

export interface Config {
  host: string
  fetch?: Fetch
  proxy?: boolean
  headers?: Headers
}

// request types

export interface Options {
  numa: boolean
  num_ctx: number
  num_batch: number
  num_gpu: number
  main_gpu: number
  low_vram: boolean
  f16_kv: boolean
  logits_all: boolean
  vocab_only: boolean
  use_mmap: boolean
  use_mlock: boolean
  embedding_only: boolean
  num_thread: number

  // Runtime options
  num_keep: number
  seed: number
  num_predict: number
  top_k: number
  top_p: number
  tfs_z: number
  typical_p: number
  repeat_last_n: number
  temperature: number
  repeat_penalty: number
  presence_penalty: number
  frequency_penalty: number
  mirostat: number
  mirostat_tau: number
  mirostat_eta: number
  penalize_newline: boolean
  stop: string[]
}

interface AbortableRequest {
  abortController?: AbortController
}

export interface GenerateRequest extends AbortableRequest{
  model: string
  prompt: string
  suffix?: string
  system?: string
  template?: string
  context?: number[]
  stream?: boolean
  raw?: boolean
  format?: string
  images?: Uint8Array[] | string[]
  keep_alive?: string | number

  options?: Partial<Options>
}

export interface Message {
  role: string
  content: string
  images?: Uint8Array[] | string[]
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  function: {
    name: string;
    arguments: {
      [key: string]: any;
    };
  };
}

export interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      required: string[];
      properties: {
        [key: string]: {
          type: string;
          description: string;
          enum?: string[];
        };
      };
    };
  };
}

export interface ChatRequest extends AbortableRequest {
  model: string
  messages?: Message[]
  stream?: boolean
  format?: string
  keep_alive?: string | number
  tools?: Tool[]

  options?: Partial<Options>
}

export interface PullRequest extends AbortableRequest {
  model: string
  insecure?: boolean
  stream?: boolean
}

export interface PushRequest extends AbortableRequest {
  model: string
  insecure?: boolean
  stream?: boolean
}

export interface CreateRequest extends AbortableRequest {
  model: string
  path?: string
  modelfile?: string
  quantize?: string
  stream?: boolean
}

export interface DeleteRequest extends AbortableRequest {
  model: string
}

export interface CopyRequest extends AbortableRequest {
  source: string
  destination: string
}

export interface ShowRequest extends AbortableRequest {
  model: string
  system?: string
  template?: string
  options?: Partial<Options>
}

export interface EmbedRequest extends AbortableRequest {
  model: string
  input: string | string[]
  truncate?: boolean
  keep_alive?: string | number

  options?: Partial<Options>
}

export interface EmbeddingsRequest extends AbortableRequest {
  model: string
  prompt: string
  keep_alive?: string | number

  options?: Partial<Options>
}

// response types

export interface GenerateResponse {
  model: string
  created_at: Date
  response: string
  done: boolean
  done_reason: string
  context: number[]
  total_duration: number
  load_duration: number
  prompt_eval_count: number
  prompt_eval_duration: number
  eval_count: number
  eval_duration: number
}

export interface ChatResponse {
  model: string
  created_at: Date
  message: Message
  done: boolean
  done_reason: string
  total_duration: number
  load_duration: number
  prompt_eval_count: number
  prompt_eval_duration: number
  eval_count: number
  eval_duration: number
}

export interface EmbedResponse {
  model: string
  embeddings: number[][]
}

export interface EmbeddingsResponse {
  embedding: number[]
}

export interface ProgressResponse {
  status: string
  digest: string
  total: number
  completed: number
}

export interface ModelResponse {
  name: string
  modified_at: Date
  size: number
  digest: string
  details: ModelDetails
  expires_at: Date
  size_vram: number
}

export interface ModelDetails {
  parent_model: string
  format: string
  family: string
  families: string[]
  parameter_size: string
  quantization_level: string
}

export interface ShowResponse {
  license: string
  modelfile: string
  parameters: string
  template: string
  system: string
  details: ModelDetails
  messages: Message[]
  modified_at: Date
  model_info: Map<string, any>
  projector_info?: Map<string, any>
}

export interface ListResponse {
  models: ModelResponse[]
}

export interface ErrorResponse {
  error: string
}

export interface StatusResponse {
  status: string
}
