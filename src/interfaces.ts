import exp from "constants";

export type Fetch = typeof fetch

export interface Config {
	address: string,
	fetch?: Fetch
}

// request types

export interface Options {
    numa: boolean;
    numCtx: number;
    numBatch: number;
    numGqa: number;
    mainGpu: number;
    lowVram: boolean;
    f16Kv: boolean;
    logitsAll: boolean;
    vocabOnly: boolean;
    useMmap: boolean;
    useMlock: boolean;
    embeddingOnly: boolean;
    opeFrequencyBase: number;
    ropeFrequencyScale: number;
    numThread: number;

    // Runtime options
    numKeep: number;
    seed: number;
    numPredict: number;
    topK: number;
    topP: number;
    tfsZ: number;
    typicalP: number;
    repeatLastN: number;
    temperature: number;
    repeatPenalty: number;
    presencePenalty: number;
    frequencyPenalty: number;
    mirostat: number;
    mirostatTau: number;
    mirostatEta: number;
    penalizeNewline: boolean;
    stop: string[];
}

export interface GenerateRequest {
	model: string
	prompt: string
	system?: string
	template?: string
	context?: number[]
	stream?: boolean
	raw?: boolean
	format?: string
	images?: Uint8Array[] | string[]

	options?: Partial<Options>
}

export interface Message {
	role: "system" | "user" | "assistant"
	content: string
	images?: Uint8Array[] | string[]
}

export interface ChatRequest {
	model: string
	messages?: Message[]
	stream?: boolean
	format?: string

	options?: Partial<Options>
}

export interface PullRequest {
	name: string
	insecure?: boolean
	username?: string
	password?: string
	stream?: boolean
}

export interface PushRequest {
	name: string
	insecure?: boolean
	username?: string
	password?: string
	stream?: boolean
}

export interface CreateRequest {
	name: string
	path?: string
	modelfile?: string
	stream?: boolean
}

export interface DeleteRequest {
	name: string
}

export interface CopyRequest {
	source: string
	destination: string
}

export interface ShowRequest {
	model: string
	system?: string
	template?: string
	options?: Partial<Options>
}

export interface EmbeddingsRequest {
	model: string
	prompt: string

	options?: Partial<Options>
}

// response types

export interface GenerateResponse {
	model: string
	createdAt: Date
	response: string
	done: boolean
	context: number[]
	totalDuration: number
	loadDuration: number
	promptEvalCount: number
	promptEvalDuration: number
	evalCount: number
	evalDuration: number
}

export interface ChatResponse {
	model: string
	createdAt: Date
	message: Message
	done: boolean
	totalDuration: number
	loadDuration: number
	promptEvalCount: number
	promptEvalDuration: number
	evalCount: number
	evalDuration: number
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
	modifiedAt: Date
	size: number
	digest: string
	format: string
	family: string
	families: string[]
	parameterSize: string
	quatizationLevel: number
}

export interface ShowResponse {
	license: string
	modelfile: string
	parameters: string
	template: string
	system: string
	format: string
	family: string
	families: string[]
	parameterSize: string
	quatizationLevel: number
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
