import { Ollama } from '../../src/index.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ollama = new Ollama();

// Define the schema for friend info
const FriendInfoSchema = z.object({
    name: z.string(),
    age: z.number().int(),
    is_available: z.boolean()
});

// Define the schema for friend list
const FriendListSchema = z.object({
    friends: z.array(FriendInfoSchema)
});

async function run() {
    // Convert the Zod schema to JSON Schema format
    const jsonSchema = zodToJsonSchema(FriendListSchema);

    // Can use manually defined schema directly
    // const schema = { 'type': 'object', 'properties': { 'friends': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'name': { 'type': 'string' }, 'age': { 'type': 'integer' }, 'is_available': { 'type': 'boolean' } }, 'required': ['name', 'age', 'is_available'] } } }, 'required': ['friends'] }

    const messages = [{
        role: 'user',
        content: 'I have two friends. The first is Ollama 22 years old busy saving the world, and the second is Alonso 23 years old and wants to hang out. Return a list of friends in JSON format'
    }];

    const response = await ollama.chat({
        model: 'llama3.1:8b',
        messages: messages,
        format: jsonSchema, // or format: schema
        options: {
            temperature: 0 // Make responses more deterministic
        }
    });

    // Parse and validate the response
    try {
        console.log('\n', response.message.content, '\n');
        const friendsResponse = FriendListSchema.parse(JSON.parse(response.message.content));
        console.log('\n', friendsResponse, '\n');
    } catch (error) {
        console.error("Generated invalid response:", error);
    }
}

run().catch(console.error);