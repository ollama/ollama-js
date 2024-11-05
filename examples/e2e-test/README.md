# e2e-test

Run `ollama-js` in different JavaScript projects.

## Run End-to-End Tests
### Requirements
- ollama is running locally
- pull `llama3.2:1b`

```bash
bun run e2e.ts
```

## Projects
Install your working `ollama-js` build from the root of the project. For example,
```bash
npm install
```

### common-js
```
bun install
bun run index.ts
```

### typescript
```
bun install
bun run index.ts
```

### react
```
bun install
bun start
```
