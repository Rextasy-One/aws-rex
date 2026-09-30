/**
 * Canonical Prettier configuration for the whole workspace.
 * Pods re-export this file from their own `prettier.config.mjs` so there is a
 * single source of truth (see docs/TOOLING.md).
 *
 * @type {import('prettier').Config}
 */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
};

export default config;
