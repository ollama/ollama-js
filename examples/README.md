# Examples

> [!IMPORTANT]
> Note: Ensure that `npm build` has been run before running the examples.

## Directory Structure

```
examples/
├── abort/                    # Request abortion examples
│   ├── abort-all-requests.ts # How to abort all ongoing requests
│   └── abort-stream.ts      # How to abort individual streams
│
├── fill-in-middle/          # Text completion examples
│   └── fill-middle.ts       # Middle-text completion demo
│
├── multimodal/              # Multi-modal input examples
│   └── image.ts            # Image processing example
│
├── pull-progress/           # Progress tracking
│   └── progress.ts         # Model download progress demo
│
├── structured_outputs/      # Structured data handling
│   ├── json.ts             # JSON output example
│   └── types.ts            # TypeScript types demo
│
└── tools/                  # Tool usage examples
    ├── basic.ts            # Basic tool integration
    └── complex.ts          # Advanced tool usage
```

## Running Examples

To run any example:

```sh
npx tsx <folder-name>/<file-name>.ts
```

For instance:
```sh
# Run the image processing example
npx tsx multimodal/image.ts

# Run the JSON output example
npx tsx structured_outputs/json.ts
```

## Example Categories

1. **Request Management**
   - Abort examples show how to manage and cancel requests
   - Progress tracking for long-running operations

2. **Input/Output Handling**
   - Multimodal examples for image and text processing
   - Structured output examples for JSON and typed responses

3. **Advanced Features**
   - Tool integration examples
   - Fill-in-middle completion demonstrations

## Best Practices

- Always check for errors and handle them appropriately
- Use TypeScript types for better code reliability
- Follow the structured output patterns for consistent data handling
- Implement proper cleanup in streaming examples
