import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const compiler = require.resolve('typescript/bin/tsc')
const nodeTypes = JSON.parse(
  readFileSync(require.resolve('@types/node/package.json'), 'utf8'),
)
let consumer: string

function npm(args: string[], cwd: string) {
  const cli = process.env.npm_execpath
  return execFileSync(cli ? process.execPath : 'npm', cli ? [cli, ...args] : args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
  })
}

beforeAll(() => {
  consumer = mkdtempSync(join(tmpdir(), 'ollama-package-types-'))
  npm(['run', 'build'], root)
  const [packed] = JSON.parse(
    npm(['pack', '--json', '--pack-destination', consumer], root),
  )
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true }))
  npm(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(consumer, packed.filename),
      `@types/node@${nodeTypes.version}`,
    ],
    consumer,
  )
  const source = `import ollama, { type GenerateResponse } from 'ollama/browser'
const response: Promise<GenerateResponse> = ollama.generate({ model: 'type-only', prompt: 'hello', stream: false })
void response
`
  for (const name of ['browser.ts', 'browser.mts', 'browser.cts']) {
    writeFileSync(join(consumer, name), source)
  }
  writeFileSync(join(consumer, 'root.ts'), source.replace('ollama/browser', 'ollama'))
  writeFileSync(
    join(consumer, 'invalid.mts'),
    `import { type GenerateResponse, type NoSuchResponse } from 'ollama/browser'
const response: GenerateResponse = 'not a response'
let missing: NoSuchResponse
void response
void missing
`,
  )
}, 60_000)

afterAll(() => {
  if (consumer) rmSync(consumer, { recursive: true, force: true })
})

function compile(
  file: string,
  module: string,
  moduleResolution: string,
  types: string[] = [],
) {
  const config = join(consumer, 'tsconfig.json')
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        esModuleInterop: true,
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module,
        moduleResolution,
        types,
      },
      files: [file],
    }),
  )
  return spawnSync(
    process.execPath,
    [compiler, '--project', config, '--pretty', 'false'],
    {
      cwd: consumer,
      encoding: 'utf8',
      timeout: 30_000,
    },
  )
}

const cases: [string, string, string, string[]][] = [
  ['browser.ts', 'CommonJS', 'Node', []],
  ['root.ts', 'CommonJS', 'Node', ['node']],
  ['browser.mts', 'NodeNext', 'NodeNext', []],
  ['browser.cts', 'NodeNext', 'NodeNext', []],
  ['browser.cts', 'Node16', 'Node16', []],
  ['browser.ts', 'ESNext', 'Bundler', []],
]

it.each(cases)('resolves packed %s with %s/%s', (file, module, resolver, types) => {
  const result = compile(file, module, resolver, types)
  expect(result.error).toBeUndefined()
  expect(result.stdout + result.stderr).toBe('')
  expect(result.status).toBe(0)
})

it('rejects missing exports and invalid values using the packed declarations', () => {
  const result = compile('invalid.mts', 'NodeNext', 'NodeNext')
  expect(result.error).toBeUndefined()
  expect(result.status).not.toBe(0)
  expect(result.stdout).toMatch(/TS(2305|2614)/)
  expect(result.stdout).toContain('TS2322')
})
