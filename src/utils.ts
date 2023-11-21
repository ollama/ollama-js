import type { Fetch, ErrorResponse } from "./interfaces.js";

export const formatAddress = (address: string): string => {
	if (!address.startsWith("http://") && !address.startsWith("https://")) {
		address = `http://${address}`;
	}

	while (address.endsWith("/")) {
		address = address.substring(0, address.length - 1);
	}

	return address;
};

const checkOk = async (response: Response): Promise<void> => {
	if (!response.ok) {
		let message = await response.text();

		try {
			message = (JSON.parse(message) as ErrorResponse).error;
		} catch(error) {
			// Do nothing.
		}

		throw new Error(message);
	}
};

export const get = async (fetch: Fetch, address: string): Promise<Response> => {
	const response = await fetch(formatAddress(address));

	await checkOk(response);

	return response;
};

export const post = async (fetch: Fetch, address: string, data?: Record<string, unknown>): Promise<Response> => {
	const response = await fetch(formatAddress(address), {
		method: "POST",
		body: JSON.stringify(data)
	});

	await checkOk(response);

	return response;
};

export const del = async (fetch: Fetch, address: string, data?: Record<string, unknown>): Promise<Response> => {
	const response = await fetch(formatAddress(address), {
		method: "DELETE",
		body: JSON.stringify(data)
	});

	await checkOk(response);

	return response;
};

export const parseJSON = async function * <T = unknown>(itr: ReadableStream<Uint8Array>): AsyncGenerator<T> {
	const decoder = new TextDecoder("utf-8");
	let buffer = "";

	// TS is a bit strange here, ReadableStreams are AsyncIterable but TS doesn't see it.
	for await (const chunk of itr as unknown as AsyncIterable<Uint8Array>) {
		buffer += decoder.decode(chunk);

		const parts = buffer.split("\n");

		buffer = parts.pop() ?? "";

		for (const part of parts) {
			try {
				yield JSON.parse(part);
			} catch (error) {
				console.warn("invalid json: ", part);
			}
		}
	}

	for (const part of buffer.split("\n").filter(p => p !== "")) {
		try {
			yield JSON.parse(part);
		} catch (error) {
			console.warn("invalid json: ", part);
		}
	}
};
