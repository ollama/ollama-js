export interface Config {
	address: string
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

// Responses:
export interface TagsResponse {
	models: {
		name: string
		modified_at: string
		size: number
	}[]
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
