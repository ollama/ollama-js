import { Ollama, Message } from 'ollama';
import fs from 'fs';

(async () => {
    const ollama = new Ollama();

    // chat

    console.log("chatting...");

    const msgs: Message[] = [
        { role: "system", content: "you are mario" },
        { role: "user", content: "hello" },
    ];
    const resp1 = await ollama.chat({ model: "llama3.1", messages: msgs });
    console.log(resp1.message.content);
    msgs.push(resp1.message);

    msgs.push({ role: "user", content: "what is your name?" });

    const resp2 = await ollama.chat({ model: "llama3.1", messages: msgs });
    console.log(resp2.message.content);
    msgs.push(resp2.message);
    console.log("\n");
})();
