import ollama from '../../src/index';
import { Message } from '../../src/interfaces';

async function main(): Promise<void> {
    const messages: Message[] = [
        { role: "user", content: "Why is the sky blue?" },
    ];
    const response = await ollama.chat({model: "mistral", messages});
    console.log(response.message.content);
}

await main();