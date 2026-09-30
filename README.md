# aws-rex

A pnpm workspace that hosts several independent product repositories — called **pods** — side by side.

## The `src/` pod pattern

Every direct child of `src/` is its **own git repository**:

- It has its own `package.json`, its own GitHub remote, and its own release cadence.
- It is linked into the workspace by `pnpm-workspace.yaml` (`packages: ['src/*']`), so pods can
  depend on each other with the `workspace:*` protocol.
- The workspace root `.gitignore` ignores `src/*/`, so the nested repos are tracked
  **independently** and are never double-committed by the root repo.

In short: the root is an **orchestrator**, not a package. `src/` is a shelf of self-contained
repos, not a folder of the root project's source.

```
aws-rex/                     # workspace root  (Rextasy-One/aws-rex)
├── pnpm-workspace.yaml      # pod glob + shared dependency catalog
├── eslint.config.mjs        # canonical ESLint flat config
├── prettier.config.mjs      # canonical Prettier config
├── docs/                    # workspace docs (tooling, roadmap)
└── src/
    ├── common-components/   # pod: shared React UI   (Rextasy-One/common-components)
    ├── dashboard/           # pod: Next.js app       (Rextasy-One/dashboard)
    └── marketing-site/      # pod: static site       (Rextasy-One/marketing-site)
```

## Pods

| Pod                          | Repository                      | Stack                                     | Depends on        |
| ---------------------------- | ------------------------------- | ----------------------------------------- | ----------------- |
| `@aws-rex/common-components` | `Rextasy-One/common-components` | React 19 + TypeScript (source library)    | —                 |
| `@aws-rex/dashboard`         | `Rextasy-One/dashboard`         | Next.js 16 (App Router) + Tailwind 4 + TS | common-components |
| `@aws-rex/marketing-site`    | `Rextasy-One/marketing-site`    | Static site (placeholder)                 | common-components |

## Quickstart

```bash
pnpm install
pnpm dev:dashboard   # http://localhost:3000
```

## Workspace commands

| Command                             | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm lint`                         | ESLint across every pod                        |
| `pnpm format` / `pnpm format:check` | Prettier across every pod                      |
| `pnpm typecheck`                    | `tsc --noEmit` in every pod that defines it    |
| `pnpm test`                         | Unit tests (Vitest)                            |
| `pnpm build`                        | Build every pod that defines it                |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` + `test` |

## Tooling

Lint and format configuration live **once** at the workspace root and every pod re-exports them, so
there is a single source of truth. Dependency versions are pinned in a pnpm **catalog** so they never
drift between pods. See [`docs/TOOLING.md`](./docs/TOOLING.md).

## Roadmap

The prioritized backlog lives in [`docs/ROADMAP.md`](./docs/ROADMAP.md).
