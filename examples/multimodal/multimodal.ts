import https from 'https';
import ollama from '../../src/index';

interface XKCDResponse {
    num: number;
    alt: string;
    img: string;
}

async function fetchImageAsBuffer(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        https.get(url, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
    });
}

async function main(): Promise<void> {
    try {
        // Fetch the latest XKCD comic info
        const latestComicResponse = await fetch('https://xkcd.com/info.0.json');
        const latestComic: XKCDResponse = await latestComicResponse.json();

        // Fetch the image data as a Buffer
        const imageBuffer: Buffer = await fetchImageAsBuffer(latestComic.img);

        const response = await ollama.generate({ model: 'llava', prompt: 'explain this comic:', images: [imageBuffer], stream: true })
        for await (const part of response) {
            process.stdout.write(part.response)
        }
    } catch (error) {
        console.error(error);
    }
}

await main();
