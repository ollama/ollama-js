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
			throw new Error(`Failed:\n${await response.text()}`);
		}

		const json = await response.json() as TagsResponse;

		return json.models.map(m => ({
			name: m.name,
			modifiedAt: new Date(m.modified_at),
			size: m.size
		}));
	}
}
