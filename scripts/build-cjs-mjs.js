const fs = require('fs');
const path = require('path');

// Function to create a package.json file with specified type
function createPackageJson(dir, type) {
    const content = {
        type: type
    };
    const filePath = path.join(dir, 'package.json');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(content, null, 4));
}

createPackageJson('dist/cjs', 'commonjs');
createPackageJson('dist/mjs', 'module');
