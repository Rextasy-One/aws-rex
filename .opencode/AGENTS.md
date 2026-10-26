# Aws Rex — Agent Rules

Project-level rules for agents working in this workspace. These are specific to this repository and
sit alongside the global profile in `~/.config/opencode/AGENTS.md`.

The rules below are **derived from real failures in this codebase**, not generic advice. Each one
exists because it already cost time.

---

## 1. Evidence rules

This is the most important section. The recurring failure mode is **reporting success against weak
evidence**.

### 1.1 The browser is the source of truth for browser-facing work

A `200` from `curl` proves almost nothing about whether a page works. This has failed twice here:

- A TLS proxy returned `200` with a **stale `content-encoding` header**. Body was plain bytes,
  browser tried to gunzip them, page was blank. Every `curl` check said "fine".
- A route returned `200` while the composed URL was `/dashboard/dashboard`.

**Required for any UI change:**

1. Open the page in the browser tool and read the **console** for errors.
2. Screenshot it and actually look at the result.

Do not report a UI change as working on the basis of HTTP status, rendered HTML text, or a
successful build. Use `curl` for headers and payload inspection, never as proof a page works.

### 1.2 Probe framework internals; never reason about them

Assumptions about framework behaviour have been wrong here more than once. Verified example: Next's
`usePathname()` **strips** `basePath` rather than including it — the opposite of the intuitive
reading, and it silently broke active-nav highlighting.

When behaviour depends on a framework, check it:

- read `node_modules/<pkg>` source for the actual implementation;
- or render a throwaway probe component and read the value.

A wrong assumption here produces code that looks correct and is not.

### 1.3 Verify external APIs before designing against them

Check the real response shape first. In this repo that already caught two blocking facts:

- the Rick and Morty API has **no season filter** (`?episode=S01` is substring matching, not a
  season selector), and
- **`Episode` has no image field** — there is no thumbnail to display.

Discovering that after building would mean throwing the work away. One `curl` prevents it.

### 1.4 State uncertainty explicitly

If something is unverified, say so. "Not tested because X" is useful; an unqualified "done" is not.
Never describe code as working when only a type-check or build has passed.

---

## 2. Change discipline

### 2.1 Read back after structural edits

A malformed `edit` once mangled `items.map(...)` in `Header.tsx`. The React key warning in the
browser console caught it — not the edit itself.

After any non-trivial edit, re-read the changed region. A green type-check does not prove the code
says what you intended.

### 2.2 Prefer targeted edits over bulk regex

Colliding `perl -pi -e` substitutions corrupted several docs at once, producing text like
`'source-repos/*'` and `source-reposconfig`. It was caught only by grepping for corruption
afterwards.

- Use `edit` for prose and code.
- If a bulk rewrite is genuinely necessary, run it, then **grep for corruption markers** before
  committing.

### 2.3 Sanity-check composed values

`basePath` + a route both named `dashboard` produced `/dashboard/dashboard`. Neither piece was wrong
alone.

When a value is composed from parts — URLs, paths, identifiers, env-derived strings — print the
final result and read it.

### 2.4 Verify before destructive or global commands

Per the global profile: confirm working directory and targets first. `pkill`-style commands and
`rm -rf` against generated output have already caused confusing failures here (a stale server on a
port made a fresh run fail with a misleading error).

---

## 3. Architecture rules

These are settled decisions. Follow them; raise a concern rather than quietly diverging.

### 3.1 Only versioned artifacts cross a repo boundary

`source/*` entries are **independent git repositories**. Do not:

- reference another repo by relative path (`../../eslint.config.mjs`);
- use `workspace:*` or `catalog:` in a `package.json` (both are publish-time-only rewrites, so a
  standalone clone cannot resolve them).

Use semver ranges. The workspace root links local checkouts via `linkWorkspacePackages: true`.
Full reasoning: `docs/ADR-0001-repo-topology.md`.

### 3.2 One origin

Everything is served from `https://localhost:3000`. Register OAuth redirect URIs against that
origin only. Never expose `:3001` or `:3002` to the browser — they are loopback implementation
details. Rationale: `docs/DEV-ENVIRONMENT.md`.

### 3.3 Never double-nest a path

`/dashboard/dashboard` was a real bug. A mounted app's public URL is its `basePath` and nothing more.

### 3.4 Keep shared packages framework-agnostic

`@aws-rex/common-components` must not import Next APIs. Router knowledge is passed in as props (see
`activeHref`) and supplied by a thin client wrapper in each app.

### 3.5 No secrets in git

Credentials live in `.env.local` (gitignored). `.env.example` documents the keys and is committed.
If a development placeholder secret is needed to let the app boot, it must be clearly labelled and
must **fail in production**.

---

## 4. Interaction rules

Carrying forward the global profile, with additions this project has shown to need:

- **Direct and laconic.** Answer first, rationale second. No pleasantries.
- **Flag risks before building, not after.** Two findings (no season filter; no episode images)
  changed the design. Raising them up front saved rework — do that every time, even when it delays
  starting.
- **Surface the honest limitation.** Example: the login buttons compose vendor glyphs, and Google
  and Apple publish their own button-asset rules. Say that rather than implying compliance.
- **Do not silently expand scope.** If a task implies a decision (which API, which library), ask.
- **Own mistakes plainly.** When something was reported working and was not, lead with that.

---

## 5. Definition of done

A change is done when **all** of these hold:

1. `pnpm check` passes (format, lint, typecheck, unit tests).
2. The affected app **builds** (`pnpm build`).
3. Browser-facing changes were **opened in the browser** and the console read (see §1.1).
4. Composed values (URLs, paths) were inspected (§2.3).
5. Changes are committed **per source repo**, conventional commits, atomic.
6. Anything unverified is stated explicitly (§1.4).

If a step was skipped, say so rather than implying it passed.
