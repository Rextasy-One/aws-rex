# Roadmap

Prioritized, top to bottom. Shipped work is listed for context.

## Shipped

1. **READMEs** in every repo + the `source/` source-repo pattern documentation.
2. **Polyrepo topology** ([ADR-0001](./ADR-0001-repo-topology.md)): versioned artifacts only across
   repo boundaries; no `catalog:`, no `workspace:*`.
3. **`@aws-rex/config`** (`Rextasy-One/config`): shared ESLint / Prettier / tsconfig as a package
   with peers; consumed by name via semver + `linkWorkspacePackages`.
4. **`common-components`**: `Header`, `Footer`, canonical `BRAND` constant, unit tests.
5. **`dashboard`**: Next.js 16 (App Router) + Tailwind 4 Hello World consuming the shared components
   from source (`transpilePackages` + Tailwind `@source`).
6. **`marketing-site`**: promoted to a real Next.js app serving the workspace splash at `/`, with a
   `/resume` stub. Shared header nav is Home / Dashboard / Resume.

## Next

7. **Production topology for the dashboard.** Development is handled: the marketing site (3000) runs
   on the canonical port and proxies `/dashboard` to the dashboard (3001) via `DASHBOARD_ORIGIN`.
   For production, set that origin to the dashboard's deployed URL — or front both with one
   load balancer / reverse proxy.
8. **Resume content.** `source/marketing-site/src/app/resume/page.tsx` is a stub.
9. **Publish the shared packages (deferred).** Development is intentionally local-first: local links
   cover everything until release. When publishing to the **AWS private registry (CodeArtifact)**:
   - authenticate with `aws codeartifact login` and scope `@aws-rex:registry` in `.npmrc`;
   - add `publishConfig` to `@aws-rex/config` and `@aws-rex/common-components`;
   - decide the `common-components` artifact (raw TS source today; `tsup` + `dist` for registry);
   - keep tokens out of the repo.
     See [`TOOLING.md`](./TOOLING.md#deferred-publishing-to-aws-codeartifact).
10. **Renovate/Dependabot.** Per-repo config to keep shared-package ranges and toolchain versions
    current across teams — the polyrepo replacement for `catalog:`.
11. **`common-components` harness.** A standalone preview so the library is reviewable on GitHub
    independently. Recommended: **Vite + React preview** (light, static-deployable); Storybook once
    the surface grows.

## Later

12. **Apollo GraphQL in `dashboard`.** App Router RSC-friendly Apollo setup plus a first query.
13. **Per-repo CI.** Each source repo runs `install && check` (and `build` for apps) in its own repo, with no
    dependency on the workspace root — the real test of the polyrepo boundary.
14. **Typed lint rules.** Move `typescript-eslint` from `recommended` to `recommendedTypeChecked`
    (project service). Blocked on TS 7 support in `typescript-eslint`.
15. **`strictPeerDependencies`.** Optional hard-fail on peer conflicts, if teams want it enforced
    rather than auto-resolved.
