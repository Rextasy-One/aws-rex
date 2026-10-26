---
name: prettier
description: Use when formatting files, fixing code layout, or checking style before a commit.
---

# Prettier

Formatting is centralised. Do not hand-format, and do not introduce a second formatting tool.

## Where the config lives

Canonical config is the `@aws-rex/config` package (`Rextasy-One/config`), referenced by **name**:

```jsonc
// any package.json in the workspace
{ "prettier": "@aws-rex/config/prettier" }
```

There must be no `prettier.config.*` file in a source repo, and no `../../` path to the workspace
root. If you find one, it is a regression.

## How to run it

```bash
pnpm format         # write, across every source repo
pnpm format:check   # verify, included in `pnpm check`
```

Prefer the root scripts. They delegate into each source repo, which matters because the workspace
`.gitignore` ignores `source/*/` and Prettier honours `.gitignore` — a bare `prettier .` at the root
would silently skip every source repo.

## Rules

- Never reformat unrelated files in a feature commit. Keep diffs reviewable.
- If `pnpm format` changes a file you did not touch, say so rather than committing it silently.
- Config changes belong in `@aws-rex/config`, not in this workspace.
