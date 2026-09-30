# Tooling

Shared tooling is a **versioned package**, not files owned by the workspace root. See
[`ADR-0001`](./ADR-0001-repo-topology.md) for why.

## `@aws-rex/config`

Repo `Rextasy-One/config`. Exports:

| Subpath                               | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `@aws-rex/config/prettier`            | Prettier config object                |
| `@aws-rex/config/eslint`              | `baseConfig`, `reactConfig` factories |
| `@aws-rex/config/eslint/next`         | `nextConfig` factory                  |
| `@aws-rex/config/tsconfig/base.json`  | TS base                               |
| `@aws-rex/config/tsconfig/react.json` | TS + JSX                              |
| `@aws-rex/config/tsconfig/next.json`  | TS + Next.js                          |

Source repos consume it by name:

```jsonc
// package.json
{
  "prettier": "@aws-rex/config/prettier",
  "devDependencies": { "@aws-rex/config": "^1.0.0" },
}
```

```js
// eslint.config.mjs
import { reactConfig } from '@aws-rex/config/eslint';
export default reactConfig();
```

```jsonc
// tsconfig.json
{ "extends": "@aws-rex/config/tsconfig/react.json", "include": ["src"] }
```

No source repo contains a `prettier.config.mjs`, and no source repo references `../../`.

## Version enforcement

`@aws-rex/config` declares peers: `eslint ^9`, `prettier ^3`, `typescript ^5`, plus an optional
`eslint-config-next`. The plugin packages (`typescript-eslint`, `eslint-plugin-react`,
`eslint-plugin-react-hooks`, `eslint-config-prettier`, `@eslint/js`, `globals`) are regular
dependencies of the config package, mirroring how `eslint-config-next` ships its own plugins.

This is the "must be resolved" contract: a consumer cannot silently run a different tool major.

## Local-first development (current phase)

Until publishing is set up, develop entirely through local links. Nothing needs to be published,
version-bumped, or installed from a registry:

- `linkWorkspacePackages: true` symlinks `source/config` and `source/common-components` into every source repo.
- Editing their source is picked up **live** — no reinstall, no version bump. (Verified: changing
  `source/config/prettier.js` immediately changes what a source repo resolves.)
- Keep every `@aws-rex/*` package and its consumers on a satisfying range (currently all `1.0.0` /
  `^1.0.0`). Local linking only requires the range to match, so if a package ever moves to a new
  major, bump the consumer range in the same change.
- `preferWorkspacePackages: true` + `saveWorkspaceProtocol: false` stop `pnpm add` from writing
  `workspace:*` back into a manifest.

## Deferred: publishing to AWS CodeArtifact

Publishing and versioning are intentionally out of scope for the local-first phase. When the time
comes:

1. Authenticate: `aws codeartifact login --tool npm --repository <repo> --domain <domain> --domain-owner <account>`.
2. Scope the registry in `.npmrc` (or publishConfig):
   `@aws-rex:registry=https://<domain>-<account>.d.codeartifact.<region>.amazonaws.com/npm/<repo>/`.
3. Add `publishConfig` to `@aws-rex/config` and `@aws-rex/common-components` (the latter likely wants
   a `tsup` build + `dist` exports before publishing).
4. Introduce Changesets and bump consumer ranges on release.

Never commit CodeArtifact tokens — keep them in the developer/CI environment. See
[`ROADMAP.md`](./ROADMAP.md).

## Why there is no catalog and no `workspace:*`

Both are workspace-only protocols, expanded only at publish time. A standalone clone cannot resolve
them, which would make the workspace root a hard build dependency of every source repo. Instead:

- source repos declare plain semver ranges (registry-ready, self-describing);
- the workspace root sets `linkWorkspacePackages: true` to link local checkouts whose version satisfies
  the range;
- Renovate/Dependabot keeps ranges current across repos (the polyrepo replacement for `catalog:`).

## Entry points

Root scripts remain the workspace-wide entry points and simply delegate to each source repo:

```bash
pnpm lint          # pnpm -r run lint
pnpm lint:fix      # pnpm -r run lint -- --fix
pnpm format        # pnpm -r run format  && prettier --write .
pnpm format:check  # pnpm -r run format:check && prettier --check .
pnpm check         # format:check + lint + typecheck + test
```

Each source repo exposes `lint`, `format`, `format:check`, and (where relevant) `typecheck`, `test`, `build`.

> `pnpm format` delegates into the source repos because the workspace root `.gitignore` ignores `source/*/` and
> Prettier honors `.gitignore`.

## Dependency build scripts

pnpm 11+ blocks install scripts until approved. The approved native toolchain packages are listed
under `allowBuilds:` in `pnpm-workspace.yaml`. Add new entries deliberately.

## Version decisions

- **TypeScript 5.x**, not 7.x: `typescript-eslint` (as of 8.71.0) supports `<6.1.0`.
- **ESLint 9** flat config; the plugin ecosystem and `eslint-config-next` target it.
- **Vitest 5** for component unit tests (jsdom + Testing Library).
