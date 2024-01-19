import { Ollama } from '../../src/index';

async function main(): Promise<void> {
    const client: Ollama = new Ollama();
    const stream = await client.generate({model: "mistral", prompt: "Why is the sky blue?", stream: true});
    for await (const part of stream) {
        process.stdout.write(part.response);
    }
}

await main();