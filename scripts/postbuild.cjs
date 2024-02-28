const fs = require('fs')

const packageJson = JSON.stringify({ type: 'commonjs' }, null, 2)

fs.writeFileSync('./dist/cjs/package.json', `${packageJson}\n`)
