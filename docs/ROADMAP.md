# Roadmap

Prioritized, top to bottom. Shipped work is listed for context.

## Shipped

1. **READMEs** in every repo + the `src/` pod pattern documentation.
2. **Polyrepo topology** ([ADR-0001](./ADR-0001-repo-topology.md)): versioned artifacts only across
   repo boundaries; no `catalog:`, no `workspace:*`.
3. **`@aws-rex/config`** (`Rextasy-One/config`): shared ESLint / Prettier / tsconfig as a package
   with peers; consumed by name via semver + `linkWorkspacePackages`.
4. **`common-components`**: `Header`, `Footer`, unit tests.
5. **`dashboard`**: Next.js 16 (App Router) + Tailwind 4 Hello World consuming the shared components
   from source (`transpilePackages` + Tailwind `@source`).

## Next

6. **Publish the shared packages.** Standalone clones currently resolve `@aws-rex/config@^1.0.0` and
   `@aws-rex/common-components@^1.0.0` only inside the aggregator. To make the polyrepo contract real:
   - choose a target — private registry, GitHub Packages, or git tags
     (`github:Rextasy-One/config#vX.Y.Z`);
   - add `publishConfig` to both packages;
   - decide the publish artifact for `common-components` (raw TS source today; add `tsup` + `dist`
     exports if publishing to a registry).
7. **Renovate/Dependabot.** Per-repo config to keep shared-package ranges and toolchain versions
   current across teams — the polyrepo replacement for `catalog:`.
8. **`common-components` harness.** A standalone preview so the library is reviewable on GitHub
   independently. Recommended: **Vite + React preview** (light, static-deployable); Storybook once
   the surface grows.

## Later

9. **`marketing-site` static pipeline.** Vite or Next static export that renders the shared
   `Header`/`Footer`, proving cross-pod inter-dependency.
10. **Apollo GraphQL in `dashboard`.** App Router RSC-friendly Apollo setup plus a first query.
11. **Per-repo CI.** Each pod runs `install && check` (and `build` for apps) in its own repo, with no
    dependency on the aggregator — the real test of the polyrepo boundary.
12. **Typed lint rules.** Move `typescript-eslint` from `recommended` to `recommendedTypeChecked`
    (project service). Blocked on TS 7 support in `typescript-eslint`.
13. **`strictPeerDependencies`.** Optional hard-fail on peer conflicts, if teams want it enforced
    rather than auto-resolved.
