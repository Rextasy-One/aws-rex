import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * Canonical ESLint flat config for the workspace.
 *
 * Pods re-export the factory that matches their shape:
 *   - `baseConfig()`  -> framework-agnostic TypeScript / JavaScript
 *   - `reactConfig()` -> React component libraries (adds react + react-hooks)
 *   - a Next.js pod composes `baseConfig()` with `eslint-config-next`.
 *
 * See docs/TOOLING.md for the "root is the single source of truth" contract.
 */

const SOURCE_GLOB = ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];

const sharedIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.config.{js,mjs,cjs,ts,mts,cts}',
  '**/next-env.d.ts',
];

const reactHooksRules = reactHooks.configs['recommended-latest'].rules;

/**
 * @param {{ browser?: boolean, globals?: Record<string, boolean | 'readonly' | 'writable'> }} [options]
 */
export function baseConfig({ browser = false, globals: extraGlobals = {} } = {}) {
  return defineConfig([
    globalIgnores(sharedIgnores),
    {
      files: SOURCE_GLOB,
      languageOptions: {
        globals: {
          ...globals.node,
          ...(browser ? globals.browser : {}),
          ...extraGlobals,
        },
      },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
  ]);
}

/**
 * @param {{ globals?: Record<string, boolean | 'readonly' | 'writable'> }} [options]
 */
export function reactConfig(options = {}) {
  return defineConfig([
    ...baseConfig({ browser: true, ...options }),
    {
      files: ['**/*.{jsx,tsx}'],
      ...react.configs.flat.recommended,
      settings: { react: { version: 'detect' } },
    },
    {
      files: ['**/*.{jsx,tsx}'],
      plugins: { 'react-hooks': reactHooks },
      rules: reactHooksRules,
    },
    {
      files: ['**/*.{jsx,tsx}'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
  ]);
}

export default baseConfig();
