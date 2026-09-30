# aws-rex

A **local development aggregator** for independent repositories ("source repos"). It is not a product and
not a published package.

> The design decision and tradeoffs are recorded in
> [`docs/ADR-0001-repo-topology.md`](./docs/ADR-0001-repo-topology.md).

## The coupling contract

> Across a repository boundary, the only legal coupling is a **versioned artifact**. If it cannot be
> installed by name (registry or git tag), it is not a contract.

Source repos therefore declare plain **semver** ranges — never `workspace:*` or `catalog:`, both of which
are publish-time rewrites that a standalone clone cannot resolve. This aggregator links local
checkouts only as a convenience.

## The `src/` source-repo pattern

Every direct child of `src/` is its **own git repository**:

- its own `package.json`, GitHub remote, CI, and release cadence;
- installable on its own, using only registry/tag dependencies;
- linked into this workspace via `packages: ['src/*']` for one-command local development.

The aggregator `.gitignore` ignores `src/*/`, so nested repos are tracked independently.

```
aws-rex/                     # aggregator  (Rextasy-One/aws-rex)
├── pnpm-workspace.yaml      # packages: ['src/*'] + linkWorkspacePackages: true
├── docs/                    # ADR, tooling, roadmap
└── src/
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
| `Rextasy-One/aws-rex`           | —                            | This dev aggregator (private)       |

Dependency direction: `dashboard` and `marketing-site` → `common-components`; every source repo → `config`.

## How local linking works

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'src/*'
linkWorkspacePackages: true
```

A source repo declares `"@aws-rex/config": "^1.0.0"`. Here, pnpm links the local `src/config` because its
version satisfies the range. On a standalone clone there is no workspace, so pnpm resolves the same
range from the registry — same `package.json`, two environments.

## Quickstart

```bash
pnpm install
pnpm dev:dashboard   # http://localhost:3000
```

## Commands

| Command                             | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm lint`                         | ESLint across every source repo                     |
| `pnpm format` / `pnpm format:check` | Prettier across every source repo + aggregator docs |
| `pnpm typecheck`                    | `tsc --noEmit` where defined                        |
| `pnpm test`                         | Unit tests (Vitest)                                 |
| `pnpm build`                        | Build every source repo that defines it             |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` + `test`      |

## Tooling

See [`docs/TOOLING.md`](./docs/TOOLING.md). Backlog: [`docs/ROADMAP.md`](./docs/ROADMAP.md).
