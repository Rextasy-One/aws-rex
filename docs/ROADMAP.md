# Roadmap

Prioritized, top to bottom. Shipped work is listed for context.

## Shipped

1. **READMEs** in all four repos + this workspace's `src/` pod pattern documentation.
2. **Shared ESLint/Prettier** — root config re-exported by thin per-pod configs, versions pinned via
   a pnpm catalog (`docs/TOOLING.md`).
3. **`common-components`** — `Header`, `Footer`, unit tests, TypeScript build config.
4. **`dashboard`** — Next.js 16 (App Router) + Tailwind 4 Hello World consuming the shared
   components from source (`transpilePackages` + Tailwind `@source`).

## Next

5. **`common-components` standalone harness.** Give the library its own preview surface so it can be
   reviewed on GitHub independently of any consumer. Options:
   - **Storybook** (`@storybook/react-vite`) — richest docs/controls; heaviest dependency.
   - **Minimal Vite + React preview** — light, fast, easy to deploy as a static page.
   - A tiny Next.js harness — reuses the dashboard toolchain but couples the library to Next.
     Recommendation: **Vite + React preview**, with the option to graduate to Storybook once the
     component surface grows. This is also where a self-contained lint/format config should be
     bundled for standalone clones (see the caveat in `docs/TOOLING.md`).

6. **`marketing-site` static pipeline.** Replace the placeholder with a real static build (Vite or
   Next static export) that renders `Header`/`Footer`, proving the cross-pod inter-dependency.

7. **Apollo GraphQL in `dashboard`.** Introduce `@apollo/client` with the App Router RSC-friendly
   setup (`@apollo/experimental-nextjs-app-support` or the current equivalent) and a first query.

## Later

8. **Typed lint rules.** Move `typescript-eslint` from `recommended` to `recommendedTypeChecked`
   (project service). Blocked on a `typescript-eslint` release that supports TS 7 — until then it
   works on TS 5.x.
9. **CI.** A GitHub Actions workflow per pod running `pnpm install && pnpm check` (and `build` for
   apps). Because pods are independent repos, each workflow lives in its own repo.
10. **Versioning/publishing.** Changesets for `common-components`; decide the publish artifact
    (currently raw TypeScript source consumed via `transpilePackages`, so publishing to a registry
    would want a `tsup` build step and a `dist` exports map).
11. **Shared `tsconfig` base.** Optional `tsconfig.base.json` at the root if pod tsconfigs start
    duplicating compiler options.
