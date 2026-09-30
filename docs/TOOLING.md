# Tooling

## Single source of truth

Lint and format configuration live at the workspace root, not inside the pods:

- `eslint.config.mjs` — exports `baseConfig()` and `reactConfig()` factories.
- `prettier.config.mjs` — the shared Prettier options.
- `pnpm-workspace.yaml` — the `catalog:` block pins every tool version.

Each pod ships a **thin** config that re-exports the root:

```js
// src/<pod>/eslint.config.mjs
import { reactConfig } from '../../eslint.config.mjs';

export default reactConfig();
```

```js
// src/<pod>/prettier.config.mjs
export { default } from '../../prettier.config.mjs';
```

A pod that needs framework-specific rules composes on top of the root factory. `dashboard` is the
example — it spreads `baseConfig()` and then adds `eslint-config-next`:

```js
// src/dashboard/eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { baseConfig } from '../../eslint.config.mjs';

export default defineConfig([
  ...baseConfig({ browser: true }),
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
```

## Entry points

The root scripts are the lint/format **entry points** for the whole workspace:

```bash
pnpm lint          # pnpm -r run lint
pnpm lint:fix      # pnpm -r run lint -- --fix
pnpm format        # pnpm -r run format  && prettier --write .
pnpm format:check  # pnpm -r run format:check && prettier --check .
pnpm check         # format:check + lint + typecheck + test
```

> `pnpm format` must delegate into the pods: the root `.gitignore` ignores `src/*/`, and Prettier
> honours `.gitignore`, so a bare `prettier .` at the root would skip every pod.

Each pod also exposes `lint`, `format`, `format:check`, `typecheck`, and (where relevant) `test`.

## Dependency catalog

Never hard-code a tool version inside a pod. Add it to the `catalog:` block in
`pnpm-workspace.yaml` and reference it as `"catalog:"`:

```jsonc
// src/<pod>/package.json
{
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:",
  },
}
```

This keeps a pod that is checked out on its own readable: `catalog:` resolves to the same pinned
range everywhere in the workspace.

## Dependency build scripts

pnpm 11+ blocks dependency install scripts until they are approved. The approved native/build
toolchain packages (Tailwind's `@tailwindcss/oxide`, `sharp`, `unrs-resolver`) are listed under
`allowBuilds:` in `pnpm-workspace.yaml`. Add new entries there deliberately — never approve blindly.

## Version decisions

- **TypeScript 5.x**, not 7.x: `typescript-eslint` (as of 8.71.0) supports `<6.1.0`, so typed ESLint
  rules would not run against the native TS 7 compiler.
- **ESLint 9** (flat config): `eslint-config-next` and the plugin ecosystem currently target it.
- **Vitest 5** for component unit tests (jsdom + Testing Library).

## Caveat: standalone extraction

Because the root config lives _outside_ each pod's git repository, a pod cloned on its own cannot
resolve `../../eslint.config.mjs`. That is fine for the normal workspace development flow, but when a
pod is published or built in isolation it needs a self-contained config. Options are tracked in
[`ROADMAP.md`](./ROADMAP.md) (a bundled `@aws-rex/eslint-config` package, or vendoring the config at
publish time).
