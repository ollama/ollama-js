import ollama from 'ollama';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/*
    Ollama structured outputs capabilities
    It parses the response from the model into a structured JSON object using Zod
*/

// Define the schema for friend info
const FriendInfoSchema = z.object({
    name: z.string().describe('The name of the friend'),
    age: z.number().int().describe('The age of the friend'),
    is_available: z.boolean().describe('Whether the friend is available')
});

// Define the schema for friend list
const FriendListSchema = z.object({
    friends: z.array(FriendInfoSchema).describe('An array of friends')
});

async function run(model: string) {
    // Convert the Zod schema to JSON Schema format
    const jsonSchema = zodToJsonSchema(FriendListSchema);

    /* Can use manually defined schema directly
    const schema = { 
        'type': 'object', 
        'properties': { 
            'friends': { 
                'type': 'array', 
                'items': { 
                    'type': 'object', 
                    'properties': { 
                        'name': { 'type': 'string' }, 
                        'age': { 'type': 'integer' }, 
                        'is_available': { 'type': 'boolean' } 
                    }, 
                    'required': ['name', 'age', 'is_available'] 
                } 
            } 
        }, 
        'required': ['friends'] 
    }
    */

    const messages = [{
        role: 'user',
        content: 'I have two friends. The first is Ollama 22 years old busy saving the world, and the second is Alonso 23 years old and wants to hang out. Return a list of friends in JSON format'
    }];

    const response = await ollama.chat({
        model: model,
        messages: messages,
        format: jsonSchema, // or format: schema
        options: {
            temperature: 0 // Make responses more deterministic
        }
    });

    // Parse and validate the response
    try {
        const friendsResponse = FriendListSchema.parse(JSON.parse(response.message.content));
        console.log(friendsResponse);
    } catch (error) {
        console.error("Generated invalid response:", error);
    }
}

run('llama3.1:8b').catch(console.error);