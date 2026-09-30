# ADR-0001: Repository topology — polyrepo with a dev aggregator

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Platform / DevEx

## Context

`aws-rex` hosts several independent product repositories as direct children of `src/`. Each child is
its own git repository with its own GitHub remote, CI surface, and release cadence. `pnpm` links them
into one workspace for local development.

The first iteration of this setup expressed the cross-repo contract with **monorepo idioms**:

- pods re-exported the aggregator's config by relative path (`../../eslint.config.mjs`);
- dependency versions were pinned in a workspace `catalog:` and referenced with `catalog:`;
- cross-pod code used `workspace:*`.

Both `catalog:` and `workspace:` are **publish-time rewrites**. They are not resolvable by a
standalone clone: pnpm replaces them only during `pnpm publish` / `pnpm pack`, and `workspace:`
explicitly refuses to resolve outside the workspace. The result was that `aws-rex` became a hard
build dependency of every pod — the opposite of the intended autonomy.

## Decision

Treat this as a **polyrepo with a local development aggregator**, not a monorepo.

**Governing rule:** across a repository boundary, the only legal coupling is a **versioned
artifact**. If it cannot be installed by name (registry or git tag), it is not a contract.

Concretely:

1. **Shared tooling is a package.** `@aws-rex/config` (ESLint + Prettier + tsconfig) is a normal
   dependency referenced by **semver**. Pods reference it by name, never by path.
2. **Cross-pod code is a package.** `@aws-rex/common-components` is referenced by **semver**.
3. **Pods declare plain semver ranges** — no `catalog:`, no `workspace:*`.
4. **The aggregator is thin.** `pnpm-workspace.yaml` is reduced to `packages: ['src/*']` plus
   `linkWorkspacePackages: true`, which links a local pod only when its version satisfies the
   consumer's range. Local DX stays one-command; the coupling does not exist.
5. **Version enforcement is `peerDependencies`.** For example, `@aws-rex/config` peers on
   `eslint ^9`, `prettier ^3`, `typescript ^5` — the "must be resolved" guarantee, expressed where
   the ecosystem expects it.
6. **Alignment across teams is tooling, not protocol.** Renovate/Dependabot replaces `catalog:`.

## Consequences

**Positive**

- Every pod is installable, testable, and buildable from its own clone, with only registry (or
  git-tag) dependencies.
- Teams own their repo end to end; platform owns the config package.
- No hidden build dependency on the aggregator; the aggregator can be discarded without touching the
  pods.

**Negative / obligations**

- The shared packages must actually be **published** somewhere (private registry, GitHub Packages,
  or a git tag) for standalone resolution. Until then, only the aggregator can install them.
- Cross-repo changes are coordinated by **version bump + range update**, not an atomic commit. This
  is the deliberate trade for autonomy.
- Versions must be kept current with Renovate; `catalog:` no longer guarantees a singleton version.

## Alternatives considered

- **True monorepo.** One repo, one CI, one lockfile. Then `catalog:`/`workspace:*`/root config are
  all _correct_, but teams lose independent release cadence. Rejected: incompatible with the
  stated goal of team autonomy.
- **Hybrid (keep `catalog:`/`workspace:*`).** Good aggregator DX, but standalone clones cannot
  install. Rejected: violates the stated requirement.
- **No shared package; per-pod self-contained config.** Maximum autonomy, but guaranteed drift and
  duplicated rules. Rejected as the default; mitigated by a single platform package instead.

## Migration notes

- Removed: root `eslint.config.mjs`, root `prettier.config.mjs`, pod `prettier.config.mjs`, the
  workspace `catalog:` block, and `workspace:*` ranges.
- Added: the `@aws-rex/config` package (repo `Rextasy-One/config`) with subpath exports for
  `eslint`, `eslint/next`, `prettier`, and `tsconfig/*.json`.
- Pods now set `"prettier": "@aws-rex/config/prettier"`, import ESLint factories from
  `@aws-rex/config/...`, and `extends` `@aws-rex/config/tsconfig/....json`.
