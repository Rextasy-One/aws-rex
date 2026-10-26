---
name: eslint
description: Use when linting files, fixing lint errors, or adding lint rules to a source repo.
---

# ESLint

Linting is centralised in flat config. Do not add a second linter, and do not vendor rules into a
source repo.

## Where the config lives

The `@aws-rex/config` package (`Rextasy-One/config`) exports factories, imported **by name**:

```js
// eslint.config.mjs in a source repo — the whole file
import { reactConfig } from '@aws-rex/config/eslint';
export default reactConfig();
```

Available: `baseConfig()` (framework-agnostic), `reactConfig()`, and
`nextConfig()` from `@aws-rex/config/eslint/next`.

No source repo should contain a `../../` path to workspace-root config. If you see one, it is a
regression — see `docs/ADR-0001-repo-topology.md`.

## How to run it

```bash
pnpm lint          # across every source repo
pnpm lint:fix      # with --fix
```

Lint is part of `pnpm check` and must pass before a change is done.

## Rules

- **Fix the cause, not the symptom.** Prefer correcting the code over adding an inline disable.
- **Never add a blanket disable** (`/* eslint-disable */`) or relax a rule repo-wide to land a
  change. If a rule genuinely must be relaxed, change it in `@aws-rex/config` so every repo inherits
  the decision deliberately.
- Inline disables need a justification comment naming the reason.
- `no-explicit-any` is on and expected to stay on. Use generics and type guards.
- If a lint error looks wrong rather than the code being wrong, raise it instead of working around
  it.
