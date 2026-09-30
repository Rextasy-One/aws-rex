# ADR-0001: Repository topology — polyrepo with a dev workspace root

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Platform / DevEx

## Context

`aws-rex` hosts several independent product repositories as direct children of `source/`. Each child is
its own git repository with its own GitHub remote, CI surface, and release cadence. `pnpm` links them
into one workspace for local development.

The first iteration of this setup expressed the cross-repo contract with **monorepo idioms**:

- source repos re-exported the workspace root's config by relative path (`../../eslint.config.mjs`);
- dependency versions were pinned in a workspace `catalog:` and referenced with `catalog:`;
- cross-repo code used `workspace:*`.

Both `catalog:` and `workspace:` are **publish-time rewrites**. They are not resolvable by a
standalone clone: pnpm replaces them only during `pnpm publish` / `pnpm pack`, and `workspace:`
explicitly refuses to resolve outside the workspace. The result was that `aws-rex` became a hard
build dependency of every source repo — the opposite of the intended autonomy.

## Decision

Treat this as a **polyrepo with a local development workspace root**, not a monorepo.

**Governing rule:** across a repository boundary, the only legal coupling is a **versioned
artifact**. If it cannot be installed by name (registry or git tag), it is not a contract.

Concretely:

1. **Shared tooling is a package.** `@aws-rex/config` (ESLint + Prettier + tsconfig) is a normal
   dependency referenced by **semver**. Source repos reference it by name, never by path.
2. **Cross-repo code is a package.** `@aws-rex/common-components` is referenced by **semver**.
3. **Source repos declare plain semver ranges** — no `catalog:`, no `workspace:*`.
4. **The workspace root is thin.** `pnpm-workspace.yaml` is reduced to `packages: ['source/*']` plus
   `linkWorkspacePackages: true`, which links a local source repo only when its version satisfies the
   consumer's range. Local DX stays one-command; the coupling does not exist.
5. **Version enforcement is `peerDependencies`.** For example, `@aws-rex/config` peers on
   `eslint ^9`, `prettier ^3`, `typescript ^5` — the "must be resolved" guarantee, expressed where
   the ecosystem expects it.
6. **Alignment across teams is tooling, not protocol.** Renovate/Dependabot replaces `catalog:`.

## Phasing

This decision is being adopted **local-first**: the workspace root links local checkouts and nothing is
published yet. Publishing to the AWS private registry (CodeArtifact) and versioning (Changesets) are
deliberately deferred until the local development loop is settled. See
[`../docs/TOOLING.md`](./TOOLING.md#local-first-development-current-phase).

## Consequences

**Positive**

- Every source repo is installable, testable, and buildable from its own clone, with only registry (or
  git-tag) dependencies.
- Teams own their repo end to end; platform owns the config package.
- No hidden build dependency on the workspace root; the workspace root can be discarded without touching the
  source repos.

**Negative / obligations**

- The shared packages must actually be **published** somewhere (private registry, GitHub Packages,
  or a git tag) for standalone resolution. Until then, only the workspace root can install them.
- Cross-repo changes are coordinated by **version bump + range update**, not an atomic commit. This
  is the deliberate trade for autonomy.
- Versions must be kept current with Renovate; `catalog:` no longer guarantees a singleton version.

## Alternatives considered

- **True monorepo.** One repo, one CI, one lockfile. Then `catalog:`/`workspace:*`/root config are
  all _correct_, but teams lose independent release cadence. Rejected: incompatible with the
  stated goal of team autonomy.
- **Hybrid (keep `catalog:`/`workspace:*`).** Good local DX, but standalone clones cannot
  install. Rejected: violates the stated requirement.
- **No shared package; per-repo self-contained config.** Maximum autonomy, but guaranteed drift and
  duplicated rules. Rejected as the default; mitigated by a single platform package instead.

## Migration notes

- Removed: root `eslint.config.mjs` / `prettier.config.mjs`, the per-source-repo
  `prettier.config.mjs`, the workspace `catalog:` block, and `workspace:*` ranges.
- Added: the `@aws-rex/config` package (repo `Rextasy-One/config`) with subpath exports for
  `eslint`, `eslint/next`, `prettier`, and `tsconfig/*.json`.
- Source repos now set `"prettier": "@aws-rex/config/prettier"`, import ESLint factories from
  `@aws-rex/config/...`, and `extends` `@aws-rex/config/tsconfig/....json`.
