import { Ollama } from '../../src/index';

async function main(): Promise<void> {
    const prefix = `def remove_non_ascii(s: str) -> str:
"""
`;
    const suffix = `
return result
`;

    const respose = await new Ollama().generate({model: "codellama:7b-code", prompt: `<PRE> ${prefix} <SUF>${suffix} <MID>`, options: {num_predict: 128, temperature: 0, top_p: 0.9, presence_penalty: 0, stop: ["<EOT>"]}});
    console.log(respose.response);

}

await main();