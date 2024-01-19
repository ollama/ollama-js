import { Ollama } from '../../src/index';

async function main(): Promise<void> {
    const client: Ollama = new Ollama();
    const respose = await client.generate({model: "mistral", prompt: "Why is the sky blue?"});
    console.log(respose.response);
}

await main();