import { Ollama } from '../../src/index.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

const ollama = new Ollama();

// Define the schema for image objects
const ObjectSchema = z.object({
    name: z.string(),
    confidence: z.number(),
    attributes: z.record(z.any()).optional()
});

// Define the schema for image description
const ImageDescriptionSchema = z.object({
    summary: z.string(),
    objects: z.array(ObjectSchema),
    scene: z.string(),
    colors: z.array(z.string()),
    time_of_day: z.enum(['Morning', 'Afternoon', 'Evening', 'Night']),
    setting: z.enum(['Indoor', 'Outdoor', 'Unknown']),
    text_content: z.string().optional()
});

async function run() {
    // Create readline interface for user input
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Get path from user input
    const path = await new Promise<string>(resolve => {
        rl.question('Enter the path to your image: ', resolve);
    });
    rl.close();

    // Verify the file exists and read it
    try {
        const imagePath = resolve(path);
        const imageBuffer = readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // Convert the Zod schema to JSON Schema format
        const jsonSchema = zodToJsonSchema(ImageDescriptionSchema);

        const messages = [{
            role: 'user',
            content: 'Analyze this image and return a detailed JSON description including objects, scene, colors and any text detected. If you cannot determine certain details, leave those fields empty.',
            images: [base64Image]
        }];

        const response = await ollama.chat({
            model: 'llama3.2-vision',
            messages: messages,
            format: jsonSchema,
            options: {
                temperature: 0 // Make responses more deterministic
            }
        });

        // Parse and validate the response
        try {
            const imageAnalysis = ImageDescriptionSchema.parse(JSON.parse(response.message.content));
            console.log('\nImage Analysis:', imageAnalysis, '\n');
        } catch (error) {
            console.error("Generated invalid response:", error);
        }

    } catch (error) {
        console.error("Error reading image file:", error);
    }
}

run().catch(console.error);
