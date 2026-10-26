# Repo map

One line per file. Read this before searching, so agents stop re-reading the tree.

Four independent git repositories live under `source/`. Each has its own remote, and each is
installable on its own. See `docs/ADR-0001-repo-topology.md` for why.

Paths are relative to the workspace root.

## Workspace root (aws-rex)

    package.json                 Workspace scripts: dev, check, setup:certs, auth:doctor, setup:hosts.
    pnpm-workspace.yaml          Declares source/* as packages. Sets linkWorkspacePackages.
    README.md                    Overview, quickstart, and where each backlog lives.
    TODO.md                      Work blocked on a person: accounts, credentials, decisions.
    certs/                       Generated mkcert certs. Gitignored.

### docs/

    docs/ADR-0001-repo-topology.md  Why repos couple only through versioned artifacts.
    docs/DEV-ENVIRONMENT.md         Ports, auth architecture, OAuth/GraphQL constraints to expect.
    docs/LOCAL-HTTPS.md             How the TLS proxy and mkcert trust work, per browser.
    docs/ROADMAP.md                 Engineering backlog. Code-only work.
    docs/TOOLING.md                 Shared config package, local-first linking, deferred publishing.

### scripts/

    scripts/dev.mjs            Starts dashboard, marketing, and the TLS proxy together.
    scripts/dev-http.mjs       Same topology without TLS. Used when certs are not needed.
    scripts/tls-proxy.mjs      HTTPS terminator on 3000. Routes /dashboard. Handles WebSocket upgrades.
    scripts/dev-ca.mjs         Resolves the mkcert CA so Node fetches trust local HTTPS.
    scripts/setup-certs.mjs    Creates the local CA and localhost cert. Writes the Firefox policy.
    scripts/setup-hosts.mjs    Prints the /etc/hosts entry Apple sign-in requires.
    scripts/auth-doctor.mjs    Reports which OAuth providers are configured and their redirect URIs.

### .opencode/

    .opencode/AGENTS.md                  Project rules for agents, with the incidents behind each.
    .opencode/agents/code-reviewer.md    Reviewer subagent. Prioritises evidence quality.
    .opencode/agents/supervisor.md       Coordinator agent. Denies edit and bash. Delegates work.
    .opencode/opencode.json              Permission gates. Destructive commands require approval.
    .opencode/plugins/guardrails.ts      Reminder hooks: new markdown, repo map.
    .opencode/repo-map.md                This file. One line per source file.
    .opencode/skills/eslint/SKILL.md     How lint is centralised and when to change rules.
    .opencode/skills/prettier/SKILL.md   How formatting is centralised, and where config lives.
    .opencode/tsconfig.json              Types for the plugin folder. Node types, strict.
    .opencode/_observations/             Hook and skill fire logs. Signals for improving rules.

## source/config (Rextasy-One/config)

Shared ESLint, Prettier, and TypeScript config. No build step. Consumed by name, by semver.

    package.json            Exports ./prettier, ./eslint, ./eslint/next, ./tsconfig/*.json.
    prettier.js             The canonical Prettier options.
    eslint/index.js         baseConfig and reactConfig factories. Plugins are its own dependencies.
    eslint/next.js          nextConfig factory. Requires the optional eslint-config-next peer.
    tsconfig/base.json      Strict base. Target ES2022, verbatimModuleSyntax, no unchecked index access.
    tsconfig/react.json     Extends base, adds DOM libs and JSX.
    tsconfig/next.json      Extends base, relaxes what Next conflicts with, adds the Next plugin.
    eslint.config.mjs       Self-hosting config. Lints this package with itself.

## source/common-components (Rextasy-One/common-components)

Presentational React 19 components. No router imports; router state arrives as props.

    package.json                   Exports source directly. React and React DOM are peers.
    src/index.ts                   Public surface: BRAND, ROUTES, Header, Footer and their types.
    src/brand.ts                   BRAND name and ROUTES. Single source of truth for both apps.
    src/Header.tsx                 Site header. Active-route underline, external links, Log in action.
    src/Footer.tsx                 Site footer. Copyright line.
    src/Header.test.tsx            Header rendering, active matching, external links.
    src/Footer.test.tsx            Footer rendering and owner override.
    src/test/setup.ts              Vitest setup. Loads jest-dom matchers.
    vitest.config.ts               jsdom environment. Includes src/**/*.test.tsx.

## source/marketing-site (Rextasy-One/marketing-site)

The splash site. Runs on 3000. Owns authentication, because it owns the browser origin.

    package.json                              Scripts and dependencies. Port 3000.
    next.config.ts                            Proxies /dashboard to the dashboard origin.
    postcss.config.mjs                        Tailwind v4 PostCSS plugin.
    src/auth.ts                               Auth.js config. Registers providers only when configured.
    src/app/layout.tsx                        Root layout. Renders Navigation and Footer.
    src/app/page.tsx                          Splash page at /.
    src/app/login/page.tsx                    Login page. Provider buttons with brand marks.
    src/app/resume/page.tsx                   Resume page. Stub, awaiting content.
    src/app/api/auth/[...nextauth]/route.ts   Auth.js route handler. All callback URLs.
    src/components/Navigation.tsx             Client wrapper. Supplies usePathname to Header.
    src/app/globals.css                       Tailwind entry. Registers the shared library for scanning.
    .env.example                              Required OAuth env vars, with setup notes per provider.

## source/dashboard (Rextasy-One/dashboard)

The application. Runs on 3001, mounted at /dashboard by the marketing site.

    package.json                    Scripts and dependencies. Port 3001.
    next.config.ts                  Reads NEXT_PUBLIC_BASE_PATH so the app mounts under /dashboard.
    postcss.config.mjs              Tailwind v4 PostCSS plugin.
    .env.example                    Required env vars: the Google Maps API key.
    src/app/layout.tsx              Root layout. Renders Navigation, AppNav and Footer.
    src/app/page.tsx                Dashboard page at the app root route.
    src/app/map/page.tsx            Map page. Falls back to a notice when no API key.
    src/components/MapCanvas.tsx    Google Maps canvas. Centres on geolocation, falls back silently.
    src/components/AppNav.tsx       Secondary nav for featured applications.
    src/components/Navigation.tsx   Client wrapper. Re-adds basePath, which Next strips.
    src/app/globals.css             Tailwind entry. Registers the shared library for scanning.

## Generated, do not edit

    source/*/AGENTS.md, source/*/CLAUDE.md   Written by next dev. Regenerated each run.
    source/*/.next/, source/*/next-env.d.ts  Next build and dev output.
    source/*/tsconfig.tsbuildinfo            TypeScript incremental build state.

## Not listed above

These are deliberately omitted. They carry no information for an agent.

    source/*/.gitignore          Identical boilerplate in every repo.
    source/*/public/*.svg        Next starter assets, referenced by no source file.
    source/*/src/app/favicon.ico Binary.
