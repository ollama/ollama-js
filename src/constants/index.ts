const EMPTY_STRING = ''
const CODE_404 = '404'
const PROTOCOLS = {
  HTTP: 'http',
  HTTPS: 'https',
} as const
const PORTS = {
  HTTP: '80',
  HTTPS: '443',
} as const
const MESSAGES = {
  MISSING_BODY: 'Missing body',
  SUCCESS: 'Success',
  FETCHING_TEXT: 'Getting text from response',
  ERROR_FETCHING_TEXT: 'Failed to get text from error response',
  ERROR_NO_MODEL_FILE: 'Must provide either path or modelfile to create a model',
  ERROR_JSON_PARSE: 'Failed to parse error response as JSON',
  STREAMING_UPLOADS_NOT_SUPPORTED:
    'Streaming uploads are not supported in this environment.',
} as const
const REQUEST_CONSTANTS = {
  GENERATE: 'generate',
  CREATE: 'create',
  PUSH: 'push',
  PULL: 'pull',
} as const
const STREAMING_EVENTS = {
  DATA: 'data',
  END: 'end',
  ERROR: 'error',
} as const
const MODEL_FILE_COMMANDS = ['FROM', 'ADAPTER']
const OLLAMA_LOCAL_URL = 'http://127.0.0.1:11434'
const SHA256 = 'sha256'
const ENCODING = {
  HEX: 'hex',
  BASE64: 'base64',
  UTF8: 'utf8',
} as const
export {
  EMPTY_STRING,
  CODE_404,
  PROTOCOLS,
  PORTS,
  MESSAGES,
  REQUEST_CONSTANTS,
  STREAMING_EVENTS,
  MODEL_FILE_COMMANDS,
  OLLAMA_LOCAL_URL,
  SHA256,
  ENCODING,
}
