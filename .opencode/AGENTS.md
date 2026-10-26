# Aws Rex — Agent Rules

Project rules for this workspace. They sit alongside the global profile in
`~/.config/opencode/AGENTS.md`.

Each rule below exists because it already cost time here. That is why they are specific.

## Evidence

The recurring failure mode is **reporting success against weak evidence**.

**The browser is the source of truth for browser-facing work.** A `200` response proves almost nothing
about whether a page works. This has failed twice here:

- a proxy returned `200` with a stale `content-encoding` header, so the browser received plain bytes
  and rendered a blank page, while every `curl` check reported "fine";
- a route returned `200` at a composed path of `/dashboard/dashboard`.

For any UI change, open the page with the browser tool, read the console for errors, and look at the
screenshot. Do not report a UI change as working on the basis of status codes, extracted HTML text,
or a passing build. Use `curl` for headers and payloads, never as proof a page works.

**Probe framework internals, never reason about them.** Assumptions here have been wrong more than
once. Next's `usePathname()` **strips** `basePath` rather than including it — the opposite of the
intuitive reading, and it silently broke active-nav highlighting. When behaviour depends on a
framework, read the package source in `node_modules`, or render a throwaway probe and read the value.

**Verify external APIs before designing against them.** Checking first already caught two blocking
facts: the chosen episode API has no season filter, and its episode records carry no image field.
Discovering that after building would waste the work.

**State uncertainty explicitly.** "Not tested because X" is useful. An unqualified "done" is not.
Never describe code as working when only a type-check or build has passed.

## Change discipline

**Read back after structural edits.** A malformed edit once mangled a list render in `Header.tsx`. A
console warning caught it, not the edit. After any non-trivial edit, re-read the changed region. A
green type-check does not prove the code says what you intended.

**Prefer targeted edits over bulk regex.** Colliding substitutions in a bulk rewrite corrupted several
documents at once, producing text like `source-reposconfig`. It was caught only by grepping for
corruption afterwards. Use `edit` for prose and code. If a bulk rewrite is necessary, run it, then
grep for corruption markers before committing.

**Sanity-check composed values.** A `basePath` and a route segment both named `dashboard` produced
`/dashboard/dashboard`. Neither piece was wrong alone. When a value is composed from parts — URLs,
paths, identifiers, environment-derived strings — print the final result and read it.

**Confirm targets before destructive or global commands.** A stale server on a port has already made
a fresh run fail with a misleading error.

## Architecture

These are settled. Raise a concern rather than diverging quietly.

**Only versioned artifacts cross a repo boundary.** Entries under `source/` are independent git
repositories. Do not reference another repo by relative path, and do not use `workspace:*` or
`catalog:` in a `package.json` — both are publish-time-only rewrites, so a standalone clone cannot
resolve them. Use semver ranges; the workspace root links local checkouts through
`linkWorkspacePackages`. Full reasoning is in `docs/ADR-0001-repo-topology.md`.

**One origin.** Everything serves from `https://localhost:3000`. Register OAuth redirect URIs against
that origin only. Never expose the loopback ports to the browser. Details are in
`docs/DEV-ENVIRONMENT.md`.

**Never double-nest a path.** A mounted app's public URL is its `basePath` and nothing more.

**Shared packages stay framework-agnostic.** `@aws-rex/common-components` must not import Next APIs.
Router state arrives as props, supplied by a thin client wrapper in each app.

**No secrets in git.** Credentials live in `.env.local`, which is ignored. `.env.example` documents
the keys and is committed. A development placeholder secret, where one is needed to let the app boot,
must be clearly labelled and must fail in production.

## Working style

**Direct and laconic.** Answer first, rationale second.

**Flag risks before building, not after.** Two findings changed the design of the episode work. Raise
them every time, even when doing so delays starting.

**Surface the honest limitation.** The login buttons compose vendor glyphs, while Google and Apple
publish their own button-asset rules. Say that rather than implying compliance.

**Do not expand scope silently.** If a task implies a decision — which API, which library — ask.

**Own mistakes plainly.** When something was reported working and was not, lead with that.

## Done

A change is complete when all of these hold:

- `pnpm check` passes: format, lint, typecheck, unit tests.
- The affected app builds with `pnpm build`.
- Browser-facing changes were opened in the browser and the console read.
- Composed values such as URLs and paths were inspected.
- Changes are committed per source repo, with conventional commit messages, atomically.
- Anything unverified is stated explicitly.

If a step was skipped, say so rather than implying it passed.
