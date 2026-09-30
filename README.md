# aws-rex

The **workspace root** for a collection of independent source repos. It is a local development convenience — not a product and
not a published package.

> The design decision and tradeoffs are recorded in
> [`docs/ADR-0001-repo-topology.md`](./docs/ADR-0001-repo-topology.md).

## The coupling contract

> Across a repository boundary, the only legal coupling is a **versioned artifact**. If it cannot be
> installed by name (registry or git tag), it is not a contract.

Source repos therefore declare plain **semver** ranges — never `workspace:*` or `catalog:`, both of which
are publish-time rewrites that a standalone clone cannot resolve. This workspace root links local
checkouts only as a convenience.

## The `source/` source-repo pattern

Every direct child of `source/` is its **own git repository**:

- its own `package.json`, GitHub remote, CI, and release cadence;
- installable on its own, using only registry/tag dependencies;
- linked into this workspace via `packages: ['source/*']` for one-command local development.

The workspace root `.gitignore` ignores `source/*/`, so nested repos are tracked independently.

```
aws-rex/                     # workspace root  (Rextasy-One/aws-rex)
├── pnpm-workspace.yaml      # packages: ['source/*'] + linkWorkspacePackages: true
├── docs/                    # ADR, tooling, roadmap
└── source/
    ├── config/              # repo: @aws-rex/config           (Rextasy-One/config)
    ├── common-components/   # repo: @aws-rex/common-components (Rextasy-One/common-components)
    ├── dashboard/           # repo: @aws-rex/dashboard        (Rextasy-One/dashboard)
    └── marketing-site/      # repo: @aws-rex/marketing-site   (Rextasy-One/marketing-site)
```

## Repos

| Repo                            | Package                      | Role                                |
| ------------------------------- | ---------------------------- | ----------------------------------- |
| `Rextasy-One/config`            | `@aws-rex/config`            | Shared ESLint / Prettier / tsconfig |
| `Rextasy-One/common-components` | `@aws-rex/common-components` | Shared React UI primitives          |
| `Rextasy-One/dashboard`         | `@aws-rex/dashboard`         | Next.js 16 + Tailwind 4 app         |
| `Rextasy-One/marketing-site`    | `@aws-rex/marketing-site`    | Static marketing site (placeholder) |
| `Rextasy-One/aws-rex`           | —                            | This dev workspace root (private)   |

Dependency direction: `dashboard` and `marketing-site` → `common-components`; every source repo → `config`.

## How local linking works

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'source/*'
linkWorkspacePackages: true
```

A source repo declares `"@aws-rex/config": "^1.0.0"`. Here, pnpm links the local `source/config` because its
version satisfies the range. On a standalone clone there is no workspace, so pnpm resolves the same
range from the registry — same `package.json`, two environments.

## Quickstart

```bash
pnpm install
pnpm dev:dashboard   # http://localhost:3000
```

## Commands

| Command                             | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `pnpm lint`                         | ESLint across every source repo                         |
| `pnpm format` / `pnpm format:check` | Prettier across every source repo + workspace root docs |
| `pnpm typecheck`                    | `tsc --noEmit` where defined                            |
| `pnpm test`                         | Unit tests (Vitest)                                     |
| `pnpm build`                        | Build every source repo that defines it                 |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` + `test`          |

## Tooling

See [`docs/TOOLING.md`](./docs/TOOLING.md). Backlog: [`docs/ROADMAP.md`](./docs/ROADMAP.md).
