import { Ollama } from '../../src/index';

async function demonstrateOllamaAPI() {
    // Initialize custom client
    const ollama = new Ollama({
        host: 'http://127.0.0.1:11434'
    });

    try {
        // 1. Create a custom model
        console.log('Creating custom model...');
        const modelfile = `
            FROM llama3.2:1b
            SYSTEM "You are a helpful assistant who speaks like a pirate."
        `;
        await ollama.create({
            model: 'pirate-llama-1b',
            modelfile: modelfile,
            stream: true
        });

        // 2. List available models
        console.log('\nListing available models...');
        const models = await ollama.list();
        console.log('Available models:', models);

        // 3. Show model details
        console.log('\nShowing model details...');
        const modelDetails = await ollama.show({
            model: 'llama3.2:1b'
        });
        console.log('Model details:', modelDetails);

        // 4. Generate text (non-streaming)
        console.log('\nGenerating text...');
        const generateResponse = await ollama.generate({
            model: 'llama3.2:1b',
            prompt: 'Tell me a short story about a treasure.',
            system: 'You are a pirate storyteller.'
        });
        console.log('Generated text:', generateResponse);

        // 5. Generate text (streaming)
        console.log('\nStreaming text generation...');
        const streamingGenerate = await ollama.generate({
            model: 'llama3.2:1b',
            prompt: 'What are your thoughts on sailing?',
            stream: true
        });
        
        for await (const chunk of streamingGenerate) {
            process.stdout.write(chunk.response);
        }

        // 6. Chat conversation
        console.log('\n\nStarting chat conversation...');
        const chatResponse = await ollama.chat({
            model: 'llama3.2:1b',
            messages: [
                { role: 'user', content: 'How do you navigate using stars?' }
            ]
        });
        console.log('Chat response:', chatResponse);

        // 7. Streaming chat
        console.log('\nStarting streaming chat...');
        const streamingChat = await ollama.chat({
            model: 'llama3.2:1b',
            messages: [
                { role: 'user', content: 'Tell me about the different types of ships.' }
            ],
            stream: true
        });

        for await (const chunk of streamingChat) {
            process.stdout.write(chunk.message.content);
        }

        // 8. Generate embeddings
        console.log('\n\nGenerating embeddings...');
        const embeddings = await ollama.embed({
            model: 'llama3.2:1b',
            input: 'What makes a good pirate?',
            truncate: true
        });
        console.log('Embeddings:', embeddings);

        // 9. Copy model
        console.log('\nCopying model...');
        await ollama.copy({
            source: 'llama3.2:1b',
            destination: 'llama3.2:1b-backup'
        });

        // 10. List running models
        console.log('\nListing running models...');
        const runningModels = await ollama.ps();
        console.log('Running models:', runningModels);

        // 11. Pull a model
        console.log('\nPulling a model...');
        const pullStream = await ollama.pull({
            model: 'llama3.2:1b',
            stream: true
        });

        for await (const chunk of pullStream) {
            console.log('Pull progress:', chunk);
        }

        // 12. Push a model, this pushes a model to ollama.com, so only run this if you want to do a live test
        // console.log('\nPushing a model...');
        // const pushStream = await ollama.push({
        //     model: 'llama3.2:1b',
        //     stream: true
        // });

        // for await (const chunk of pushStream) {
        //     console.log('Push progress:', chunk);
        // }

        // 13. Demonstrate abort functionality
        console.log('\nDemonstrating abort...');
        const abortableGeneration = ollama.generate({
            model: 'llama3.2:1b',
            prompt: 'Write a very long story...',
            stream: true
        });

        // Abort after 1 second
        setTimeout(() => {
            console.log('Aborting generation...');
            ollama.abort();
        }, 1000);

        try {
            for await (const chunk of abortableGeneration) {
                process.stdout.write(chunk.response);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('\nGeneration was successfully aborted');
            } else {
                throw error;
            }
        }

        // 14. Clean up - Delete test models
        console.log('\nCleaning up - Deleting test models...');
        await ollama.delete({ model: 'pirate-llama-1b' });
        await ollama.delete({ model: 'llama3.2:1b-backup' });

    } catch (error) {
        console.error('Error during API demonstration:', error);
    }
}

// Run the demonstration
demonstrateOllamaAPI().then(() => {
    console.log('\nAPI demonstration completed!');
}).catch(error => {
    console.error('Fatal error:', error);
});
