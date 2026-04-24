/**
 * ESLint cho Firebase Functions TypeScript.
 * Rule nhẹ — optimize cho readability, không ép Google-style 2-space indent
 * vì project root theo Prettier-compatible 2-space đã OK.
 */
module.exports = {
  root: true,
  env: {
    es2020: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "lib/**",
    "node_modules/**",
    ".eslintrc.js",
    "jest.config.js",
  ],
  plugins: ["@typescript-eslint"],
  rules: {
    "quotes": ["error", "double", { "avoidEscape": true }],
    "indent": ["error", 2, { "SwitchCase": 1 }],
    "max-len": ["warn", { "code": 120 }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      // Test files dùng tsconfig.test.json (loose strict, include test paths).
      files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
      parserOptions: {
        project: ["tsconfig.test.json"],
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
