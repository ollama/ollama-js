import fetch from "node-fetch";
import type { Response } from "node-fetch";

export const formatAddress = (address: string): string => {
	if (!address.startsWith("http://") && !address.startsWith("https://")) {
		address = `http://${address}`
	}

	while (address.endsWith("/")) {
		address = address.substring(0, address.length - 1);
	}

	return address;
};

export const get = async (address: string): Promise<Response> => {
	const response = await fetch(formatAddress(address));

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return response;
};

export const post = async (address: string, data?: Record<string, unknown>): Promise<Response> => {
	const response = await fetch(formatAddress(address), {
		method: "POST",
		body: JSON.stringify(data)
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return response;
};
