import * as utils from "./utils.js";

import type {
	Fetch,
	Config,
	TagsResponse,
	Tag,
	GenerateResponse,
	GenerateResponseEnd,
	GenerateResult,
	CreateResponse,
	CreateStatus,
	PullResponse,
	PullResult,
	EmbeddingsResponse,
	GenerateOptions,
	GenerateRequest,
	ModelParameters
} from "./interfaces.js";

export class Ollama {
	private readonly config: Config;
	private readonly fetch: Fetch;

	constructor (config?: Partial<Config>) {
		this.config = {
			address: config?.address ?? "http://localhost:11434"
		};

		let f: Fetch | null = null;

		if (config?.fetch != null) {
			f = config.fetch;
		} else if (typeof fetch !== "undefined") {
			f = fetch;
		} else if (typeof window !== "undefined") {
			f = window.fetch;
		}

		if (f == null) {
			throw new Error("unable to find fetch - please define it via 'config.fetch'");
		}

		this.fetch = f;
	}

	async tags (): Promise<Tag[]> {
		const response = await utils.get(this.fetch, `${this.config.address}/api/tags`);
		const json = await response.json() as TagsResponse;

		return json.models.map(m => ({
			name: m.name,
			modifiedAt: new Date(m.modified_at),
			size: m.size
		}));
	}

	async * generate (model: string, prompt: string, options?: Partial<GenerateOptions>): AsyncGenerator<string, GenerateResult> {
		const parameters = options?.parameters;

		delete options?.parameters;

		const request: GenerateRequest = { model, prompt, ...options };

		if (parameters != null) {
			request.options = parameters;
		}

		const response = await utils.post(this.fetch, `${this.config.address}/api/generate`, { ...request });

		if (!response.body) {
			throw new Error("Missing body");
		}

		const itr = utils.parseJSON<GenerateResponse | GenerateResponseEnd>(response.body);

		for await (const message of itr) {
			if (message.done) {
				return {
					model: message.model,
					createdAt: new Date(message.created_at),
					context: message.context,
					totalDuration: message.total_duration,
					loadDuration: message.load_duration,
					promptEvalCount: message.prompt_eval_count,
					evalCount: message.eval_count,
					evalDuration: message.eval_duration
				};
			}

			yield message.response;
		}

		throw new Error("Did not recieve done response in stream.");
	}

	async * create (name: string, path: string): AsyncGenerator<CreateStatus> {
		const response = await utils.post(this.fetch, `${this.config.address}/api/create`, { name, path });

		if (!response.body) {
			throw new Error("Missing body");
		}

		const itr = utils.parseJSON<CreateResponse>(response.body);

		for await (const message of itr) {
			yield message.status;
		}
	}

	async copy (source: string, destination: string): Promise<void> {
		await utils.post(this.fetch, `${this.config.address}/api/copy`, {
			source,
			destination
		});
	}

	async delete (name: string): Promise<void> {
		await utils.del(this.fetch, `${this.config.address}/api/delete`, { name });
	}

	async * pull (name: string): AsyncGenerator<PullResult> {
		const response = await utils.post(this.fetch, `${this.config.address}/api/pull`, { name });

		if (!response.body) {
			throw new Error("Missing body");
		}

		const itr = utils.parseJSON<PullResponse>(response.body);

		for await (const message of itr) {
			yield {
				status: message.status,
				digest: message["digest"] ?? "",
				total: message["total"] ?? 0,
				completed: message["completed"] ?? 0
			};
		}
	}

	async embeddings (model: string, prompt: string, parameters?: Partial<ModelParameters>): Promise<number[]> {
		const response = await utils.post(this.fetch, `${this.config.address}/api/embeddings`, {
			model,
			prompt,
			options: parameters ?? {}
		});

		const json = await response.json() as EmbeddingsResponse;

		return json.embedding;
	}
}
