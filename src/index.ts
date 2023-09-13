import fetch from "node-fetch";

export interface Config {
	address: string
}

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

export class Ollama {
	private readonly config: Config;

	constructor (config?: Partial<Config>) {
		this.config = {
			address: config?.address ?? "http://localhost:11434"
		};
	}

	async tags (): Promise<Tag[]> {
		const response = await fetch(`${this.config.address}/api/tags`);

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const json = await response.json() as TagsResponse;

		return json.models.map(m => ({
			name: m.name,
			modifiedAt: new Date(m.modified_at),
			size: m.size
		}));
	}

	async * generate (model: string, prompt: string): AsyncGenerator<string, GenerateResult> {
		const response = await fetch(`${this.config.address}/api/generate`, {
			method: "POST",
			body: JSON.stringify({ model, prompt })
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		if (!response.body) {
			throw new Error("Missing body");
		}

		for await (const chunk of response.body) {
			const res: GenerateResponse | GenerateResponseEnd = JSON.parse(chunk.toString());

			if (res.done) {
				return {
					model: res.model,
					createdAt: new Date(res.created_at),
					context: res.context,
					totalDuration: res.total_duration,
					loadDuration: res.load_duration,
					promptEvalCount: res.prompt_eval_count,
					evalCount: res.eval_count,
					evalDuration: res.eval_duration
				};
			}

			yield res.response;
		}

		throw new Error("Did not recieve done response in stream.");
	}
}
