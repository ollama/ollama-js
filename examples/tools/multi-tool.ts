import ollama, { Ollama } from 'ollama';

// Mock weather functions
function getTemperature(args: { city: string }): string {
    const validCities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];

    if (!validCities.includes(args.city)) {
        return 'Unknown city';
    }

    return `${Math.floor(Math.random() * 36)} degrees Celsius`;
}

function getConditions(args: { city: string }): string {
    const validCities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];

    if (!validCities.includes(args.city)) {
        return 'Unknown city';
    }

    const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
    return conditions[Math.floor(Math.random() * conditions.length)];
}

// Tool definitions
const getTemperatureTool = {
    type: 'function',
    function: {
        name: 'getTemperature',
        description: 'Get the temperature for a city in Celsius',
        parameters: {
            type: 'object',
            required: ['city'],
            properties: {
                city: { type: 'string', description: 'The name of the city' }
            }
        }
    }
};

const getConditionsTool = {
    type: 'function',
    function: {
        name: 'getConditions',
        description: 'Get the weather conditions for a city',
        parameters: {
            type: 'object',
            required: ['city'],
            properties: {
                city: { type: 'string', description: 'The name of the city' }
            }
        }
    }
};

async function run(model: string) {
    const cities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const city2 = cities[Math.floor(Math.random() * cities.length)];

    const messages = [{
        role: 'user',
        content: `What is the temperature in ${city}? and what are the weather conditions in ${city2}?`
    }];
    console.log('----- Prompt:', messages[0].content, '\n');

    const ollama = new Ollama();
    const availableFunctions = {
        getTemperature,
        getConditions
    };

    const response = await ollama.chat({
        model: model,
        messages: messages,
        tools: [getTemperatureTool, getConditionsTool],
        stream: true,
        think: true
    });

    for await (const chunk of response) {
        if (chunk.message.thinking) {
            process.stdout.write(chunk.message.thinking);
        }
        if (chunk.message.content) {
            process.stdout.write(chunk.message.content);
        }
        if (chunk.message.tool_calls) {
            for (const tool of chunk.message.tool_calls) {
                const functionToCall = availableFunctions[tool.function.name];
                if (functionToCall) {
                    console.log('\nCalling function:', tool.function.name, 'with arguments:', tool.function.arguments);
                    const output = functionToCall(tool.function.arguments);
                    console.log('> Function output:', output, '\n');

                    messages.push(chunk.message);
                    messages.push({
                        role: 'tool',
                        content: output.toString(),
                        tool_name: tool.function.name,
                    });
                } else {
                    console.log('Function', tool.function.name, 'not found');
                }
            }
        }
    }

    console.log('----- Sending result back to model \n');

    if (messages.some(msg => msg.role === 'tool')) {
        const finalResponse = await ollama.chat({
            model: model,
            messages: messages,
            tools: [getTemperatureTool, getConditionsTool],
            stream: true,
            think: true
        });

        let doneThinking = false;
        for await (const chunk of finalResponse) {
            if (chunk.message.thinking) {
                process.stdout.write(chunk.message.thinking);
            }
            if (chunk.message.content) {
                if (!doneThinking) {
                    console.log('\n----- Final result:');
                    doneThinking = true;
                }
                process.stdout.write(chunk.message.content);
            }
            if (chunk.message.tool_calls) {
                console.log('Model returned tool calls:');
                console.log(chunk.message.tool_calls);
            }
        }
    } else {
        console.log('No tool calls returned');
    }
}

run('qwen3').catch(console.error);
