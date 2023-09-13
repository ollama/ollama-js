module.exports = {
	env: {
		commonjs: true,
		es2021: true,
		node: true,
		jest: true
	},
	parserOptions: {
		ecmaVersion: "latest"
	},
	parser: "@typescript-eslint/parser",
	extends: [
		"eslint:recommended"
	],
	rules: {
		curly: [1, "all"],
		// disallow single quotes
		quotes: [1, "double", { allowTemplateLiterals: true }],
		// force semi-colons
		semi: 1,
		// allow tabs
		"no-tabs": [0],
		// use tab indentation
		indent: [1, "tab", {
			SwitchCase: 1
		}],
		// prevent commar dangles
		"comma-dangle": [1, "never"],
		// allow paren-less arrow functions
		"arrow-parens": 0,
		// allow async-await
		"generator-star-spacing": 0,
		"no-unused-vars": [0, { args: "after-used", vars: "local" }],
		"no-constant-condition": 0,
		// allow debugger during development
		"no-debugger": process.env.NODE_ENV === "production" ? 2 : 0
	}
};
