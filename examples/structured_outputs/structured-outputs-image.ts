import ollama from 'ollama';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

/*
    Ollama vision capabilities with structured outputs
    It takes an image file as input and returns a structured JSON description of the image contents
    including detected objects, scene analysis, colors, and any text found in the image
*/

// Define the schema for image objects
const ObjectSchema = z.object({
    name: z.string().describe('The name of the object'),
    confidence: z.number().min(0).max(1).describe('The confidence score of the object detection'),
    attributes: z.record(z.any()).optional().describe('Additional attributes of the object')
});

// Schema for individual objects detected in the image
const ImageDescriptionSchema = z.object({
    summary: z.string().describe('A concise summary of the image'),
    objects: z.array(ObjectSchema).describe('An array of objects detected in the image'),
    scene: z.string().describe('The scene of the image'),
    colors: z.array(z.string()).describe('An array of colors detected in the image'),
    time_of_day: z.enum(['Morning', 'Afternoon', 'Evening', 'Night']).describe('The time of day the image was taken'),
    setting: z.enum(['Indoor', 'Outdoor', 'Unknown']).describe('The setting of the image'),
    text_content: z.string().describe('Any text detected in the image')
});

async function run(model: string) {
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
            model: model,
            messages: messages,
            format: jsonSchema,
            options: {
                temperature: 0 // Make responses more deterministic
            }
        });

        // Parse and validate the response
        try {
            const imageAnalysis = ImageDescriptionSchema.parse(JSON.parse(response.message.content));
            console.log('Image Analysis:', imageAnalysis);
        } catch (error) {
            console.error("Generated invalid response:", error);
        }

    } catch (error) {
        console.error("Error reading image file:", error);
    }
}

run('llama3.2-vision').catch(console.error);