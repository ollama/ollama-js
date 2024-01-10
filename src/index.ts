import * as utils from "./utils.js";
import { promises as fsPromises } from 'fs';
import * as path from 'path';

import type {
	Fetch,
	Config,
    GenerateRequest,
    PullRequest,
    PushRequest,
    CreateRequest,
    EmbeddingsRequest,
	GenerateResponse,
	EmbeddingsResponse,
    ListResponse,
    ProgressResponse,
    ErrorResponse,
    StatusResponse,
    DeleteRequest,
    CopyRequest,
    ShowResponse,
    ShowRequest,
    ChatRequest,
    ChatResponse,
} from "./interfaces.js";


export class Ollama {
	private readonly config: Config;
	private readonly fetch: Fetch;

	constructor (config?: Partial<Config>) {
		this.config = {
			address: config?.address ?? "http://127.0.0.1:11434"
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

    private async processStreamableRequest<T extends object>(endpoint: string, request: { stream?: boolean } & Record<string, any>): Promise<T | AsyncGenerator<T>> {
        request.stream = request.stream ?? false;
        const response = await utils.post(this.fetch, `${this.config.address}/api/${endpoint}`, { ...request });
    
        if (!response.body) {
            throw new Error("Missing body");
        }
    
        const itr = utils.parseJSON<T | ErrorResponse>(response.body);
    
        if (request.stream) {
            return (async function* () {
                for await (const message of itr) {
                    if ('error' in message) {
                        throw new Error(message.error);
                    }
                    yield message;
                    // message will be done in the case of chat and generate
                    // message will be success in the case of a progress response (pull, push, create)
                    if ((message as any).done || (message as any).status === "success") {
                        return;
                    }
                }
                throw new Error("Did not receive done or success response in stream.");
            })();
        } else {
            const message = await itr.next();
            if (!message.value.done && (message.value as any).status !== "success") {
                throw new Error("Expected a completed response.");
            }
            return message.value;
        }
    }

    private async encodeImage(image: Uint8Array | string): Promise<string> {
        if (typeof image === 'string') {
            // If image is a string, treat it as a file path
            const fileBuffer = await fsPromises.readFile(path.resolve(image));
            return Buffer.from(fileBuffer).toString('base64');
        } else {
            return Buffer.from(image).toString('base64');
        }
    }

    generate(request: GenerateRequest & { stream: true }): Promise<AsyncGenerator<GenerateResponse>>;
    generate(request: GenerateRequest & { stream?: false }): Promise<GenerateResponse>;

    async generate(request: GenerateRequest): Promise<GenerateResponse | AsyncGenerator<GenerateResponse>> {
        if (request.images) {
            request.images = await Promise.all(request.images.map(this.encodeImage));
        }
        return this.processStreamableRequest<GenerateResponse>('generate', request);
    }

    chat(request: ChatRequest & { stream: true }): Promise<AsyncGenerator<ChatResponse>>;
    chat(request: ChatRequest & { stream?: false }): Promise<ChatResponse>;

    async chat(request: ChatRequest): Promise<ChatResponse | AsyncGenerator<ChatResponse>> {
        if (request.messages) {
            for (const message of request.messages) {
                if (message.images) {
                    message.images = await Promise.all(message.images.map(this.encodeImage));
                }
            }
        }
        return this.processStreamableRequest<ChatResponse>('chat', request);
    }

    pull(request: PullRequest & { stream: true }): Promise<AsyncGenerator<ProgressResponse>>;
    pull(request: PullRequest & { stream?: false }): Promise<ProgressResponse>;

    async pull (request: PullRequest):  Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
        return this.processStreamableRequest<ProgressResponse>('pull', request);
	}

    push(request: PushRequest & { stream: true }): Promise<AsyncGenerator<ProgressResponse>>;
    push(request: PushRequest & { stream?: false }): Promise<ProgressResponse>;

    async push (request: PushRequest):  Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
        return this.processStreamableRequest<ProgressResponse>('push', request);
	}

    create(request: CreateRequest & { stream: true }): Promise<AsyncGenerator<ProgressResponse>>;
    create(request: CreateRequest & { stream?: false }): Promise<ProgressResponse>;

	async create (request: CreateRequest): Promise<ProgressResponse | AsyncGenerator<ProgressResponse>> {
        return this.processStreamableRequest<ProgressResponse>('create', request);
	}

    async delete (request: DeleteRequest): Promise<StatusResponse> {
		await utils.del(this.fetch, `${this.config.address}/api/delete`, { ...request });
        return { status: "success" };
	}
    
    async copy (request: CopyRequest): Promise<StatusResponse> {
		await utils.post(this.fetch, `${this.config.address}/api/copy`, { ...request });
        return { status: "success" };
	}

    async list (): Promise<ListResponse> {
		const response = await utils.get(this.fetch, `${this.config.address}/api/tags`);
		const listResponse = await response.json() as ListResponse;
		return listResponse;
	}

    async show (request: ShowRequest): Promise<ShowResponse> {
        const response = await utils.post(this.fetch, `${this.config.address}/api/show`, { ...request });
        const showResponse = await response.json() as ShowResponse;
        return showResponse;
    }

	async embeddings (request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
		const response = await utils.post(this.fetch, `${this.config.address}/api/embeddings`, { request });
		const embeddingsResponse = await response.json() as EmbeddingsResponse;
		return embeddingsResponse;
	}
}
