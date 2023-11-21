export type Fetch = typeof fetch

export interface Config {
	address: string,
	fetch?: Fetch
}

export interface ModelParameters {
	mirostat: number
	mirostat_eta: number
	mirostat_tau: number
	num_ctx: number
	num_gqa: number
	num_thread: number
	repeat_last_n: number
	repeat_penalty: number
	temperature: number
	stop: string
	tfs_z: number
	top_k: number
	top_p: number
}

export interface GenerateOptions {
	parameters: Partial<ModelParameters>
	context: number[]
	template: string
	system: string
}

export interface GenerateResult {
	model: string
	createdAt: Date
	context: number[]
	totalDuration: number
	loadDuration: number
	promptEvalCount: number
	evalCount: number
	evalDuration: number
}

export interface Tag {
	name: string
	modifiedAt: Date
	size: number
}

export interface PullResult {
	status: PullStatus
	digest: string
	total: number
	completed: number
}

// Responses:
export interface ErrorResponse {
	error: string
}

export interface TagsResponse {
	models: {
		name: string
		modified_at: string
		size: number
	}[]
}

export interface GenerateRequest {
	model: string
	prompt: string
	options?: Partial<ModelParameters>
	system?: string
	template?: string
	context?: number[]
}

export interface GenerateResponse {
	model: string
	created_at: string
	response: string
	done: false
}

export interface GenerateResponseEnd {
	model: string
	created_at: string
	done: true
	context: number[]
	total_duration: number
	load_duration: number
	prompt_eval_count: number
	eval_count: number
	eval_duration: number
}

export type CreateStatus = "parsing modelfile" | "looking for model" | "creating model layer" | "creating model template layer" | "creating model system layer" | "creating parameter layer" | "creating config layer" | `writing layer ${string}` | `using already created layer ${string}` | "writing manifest" | "removing any unused layers" | "success"

export interface CreateResponse {
	status: CreateStatus
}

export type PullStatus = "" | "pulling manifest" | "verifying sha256 digest" | "writing manifest" | "removing any unused layers" | "success" | `downloading ${string}`

interface PullResponseStatus {
	status: PullStatus
}

interface PullResponseDownloadStart {
	status: `downloading ${string}`
	digest: string
	total: number
}

interface PullResponseDownloadUpdate extends PullResponseDownloadStart {
	completed: number
}

export type PullResponse = PullResponseStatus | PullResponseDownloadStart | PullResponseDownloadUpdate

export interface EmbeddingsResponse {
	embedding: number[]
}
