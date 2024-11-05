const { Ollama } = require('ollama');

(async () => {
    const ollama = new Ollama();

    // generate
    console.log("generating...");

    const genStream = await ollama.generate({ model: "llama3.1", prompt: "Say 'Hello, World!'", stream: true });
    for await (const chunk of genStream) {
        process.stdout.write(chunk.response);
    }
    console.log("\n");
})();
