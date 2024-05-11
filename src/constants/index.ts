const EMPTY_STRING = ''
const MESSAGES = {
  MISSING_BODY: 'Missing body',
  SUCCESS: 'Success',
  FETCHING_TEXT: 'Getting text from response',
  ERROR_FETCHING_TEXT: 'Failed to get text from error response',
  ERROR_NO_MODEL_FILE: 'Must provide either path or modelfile to create a model',
  ERROR_JSON_PARSE: 'Failed to parse error response as JSON',
} as const
const REQUEST_CONSTANTS = {
  GENERATE: 'generate',
  CREATE: 'create',
  PUSH: 'push',
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
  MESSAGES,
  REQUEST_CONSTANTS,
  MODEL_FILE_COMMANDS,
  OLLAMA_LOCAL_URL,
  SHA256,
  ENCODING,
}
