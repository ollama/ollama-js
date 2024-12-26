module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    curly: [1, 'all'],
    'arrow-parens': 0,
    'generator-star-spacing': 0,
    'no-unused-vars': [0, { args: 'after-used', vars: 'local' }],
    'no-constant-condition': 0,
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
  },
}
