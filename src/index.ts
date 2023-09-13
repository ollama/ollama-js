import * as utils from "./utils.js";

import type {
	Config,
	TagsResponse,
	Tag,
	GenerateResponse,
	GenerateResponseEnd,
	GenerateResult
} from "./interfaces.js";

export class Ollama {
	private readonly config: Config;

	constructor (config?: Partial<Config>) {
		this.config = {
			address: config?.address ?? "http://localhost:11434"
		};
	}

	async tags (): Promise<Tag[]> {
		const response = await utils.get(`${this.config.address}/api/tags`);
		const json = await response.json() as TagsResponse;

		return json.models.map(m => ({
			name: m.name,
			modifiedAt: new Date(m.modified_at),
			size: m.size
		}));
	}

	async * generate (model: string, prompt: string): AsyncGenerator<string, GenerateResult> {
		const response = await utils.post(`${this.config.address}/api/generate`, { model, prompt });

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
