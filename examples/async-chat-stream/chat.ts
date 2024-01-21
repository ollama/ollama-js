import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import readline, { Interface } from 'readline';
import ollama from '../../src/index';
import { Message } from '../../src/interfaces';

interface CommandLineArguments {
    speak?: boolean;
}

async function speak(speaker: string | null, content: string): Promise<void> {
    if (speaker) {
        const process: ChildProcessWithoutNullStreams = spawn(speaker, [content]);
        await new Promise<void>((resolve) => process.on('close', () => resolve()));
    }
}

function parseCommandLineArguments(): CommandLineArguments {
    const args: CommandLineArguments = {};
    process.argv.slice(2).forEach((arg) => {
        if (arg.startsWith('--')) {
            const key = arg.replace('--', '');
            args[key] = true;
        }
    });
    return args;
}

async function main(): Promise<void> {
    const args: CommandLineArguments = parseCommandLineArguments();

    let speaker: string | null = null;
    if (args.speak) {
        if (process.platform === 'darwin') {
            speaker = 'say';
        } else {
            try {
                // Try to find 'espeak' or 'espeak-ng'
                const espeakPath = execSync('which espeak', { stdio: 'pipe' }).toString().trim();
                if (espeakPath) speaker = 'espeak';
        
                const espeakNgPath = execSync('which espeak-ng', { stdio: 'pipe' }).toString().trim();
                if (espeakNgPath) speaker = 'espeak-ng';
            } catch (error) {
                console.warn('No speaker found');
            }
        }
    }

    const messages: Message[] = [];
    const rl: Interface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '>>> '
    });

    rl.prompt();

    for await (const line of rl) {
        if (line) {
            messages.push({ role: 'user', content: line });

            let contentOut: string = '';
            let message = { role: 'assistant', content: '' };
            for await (const response of await ollama.chat({ model: 'mistral', messages: messages, stream: true })) {
                if (response.done) {
                    messages.push(message);
                }

                const content: string = response.message.content;
                process.stdout.write(content, 'utf-8');

                contentOut += content;
                if (['.', '!', '?', '\n'].includes(content)) {
                    await speak(speaker, contentOut);
                    contentOut = '';
                }

                message.content += content;
            }

            if (contentOut) {
                await speak(speaker, contentOut);
            }
            console.log();
            rl.prompt();
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

process.on('SIGINT', () => {
    process.exit(0);
});
