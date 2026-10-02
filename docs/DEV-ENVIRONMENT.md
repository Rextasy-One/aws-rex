# Development environment decisions

Context for future work: this workspace is the base for a modern web app that will add **OAuth** and
**GraphQL against remote services**. The choices below were made with that in mind, and the
"watch out for" section lists what will slow that work down if not addressed deliberately.

## Current shape

| Concern                   | Choice                                                        |
| ------------------------- | ------------------------------------------------------------- |
| Local origin              | One HTTPS origin, `https://localhost:3000`                    |
| TLS                       | mkcert local CA; certs in `certs/` (gitignored)               |
| Path routing              | `scripts/tls-proxy.mjs` routes `/dashboard/*` → dashboard app |
| Dashboard asset namespace | `basePath=/dashboard` → assets at `/dashboard/_next/*`        |
| Live updates              | WebSocket upgrades tunnelled through the TLS proxy            |
| Cross-repo contracts      | Versioned packages only (see ADR-0001)                        |

## Why a proxy rather than framework config

`next.config.ts` `rewrites()` fetches an HTTPS destination with global `fetch`. Global `fetch`:

- has **no custom-CA hook**, and Node ignores the system trust store;
- cannot carry **WebSocket upgrades**, which Next dev needs for HMR.

Both are hard limits, not preferences. Terminating TLS once in front of both apps removes the
certificate problem entirely (upstreams are HTTP loopback) and gives a single place to handle
upgrades.

## Watch out for

These are the things most likely to slow OAuth / GraphQL development. Ordered by expected friction.

### 1. Auth requires a single stable origin — never call upstream ports directly

OAuth redirect URIs, `SameSite`/`Secure` cookies, CSRF tokens and CORS all key off the **origin the
browser sees**. Keep it `https://localhost:3000` and keep the dashboard under `/dashboard`.

- Register exactly one redirect URI per environment: `https://localhost:3000/api/auth/callback/*`.
- Never point the browser at `:3001` or `:3002`; those are loopback implementation details.
- Adding an auth route (`/api/auth/*`) should go to the **marketing** app first, so the token cookie
  is set on the origin that renders every page. A dashboard-hosted callback will work but will not
  share cookies with the marketing app — design for it explicitly.

### 2. Auth: Auth.js in the marketing app

Auth lives in the **marketing** app because it owns the browser origin, so its session cookie is
shared with everything proxied under it (`/dashboard`).

| Piece          | Location                                                        |
| -------------- | --------------------------------------------------------------- |
| Auth.js config | `source/marketing-site/src/auth.ts`                             |
| Route handler  | `source/marketing-site/src/app/api/auth/[...nextauth]/route.ts` |
| Login page     | `source/marketing-site/src/app/login/page.tsx`                  |
| Credentials    | `source/marketing-site/.env.local` (gitignored)                 |
| Status check   | `pnpm auth:doctor`                                              |

Providers register **only when their credentials exist**, so the app runs before any OAuth app is
created. Until then `/login` renders each provider disabled with the exact env vars it needs, and
`/api/auth/providers` returns `{}`. Fill in `.env.local` and it works with no code change.

Redirect URIs (must match **exactly** — no wildcards):

```
https://localhost:3000/api/auth/callback/google
https://localhost:3000/api/auth/callback/facebook
https://localhost:3000/api/auth/callback/apple
```

#### Localhost support per provider

| Provider | localhost allowed? | Notes                                                                |
| -------- | ------------------ | -------------------------------------------------------------------- |
| Google   | ✅ `http` exempt   | Google exempts localhost from its HTTPS rule. Exact match required.  |
| Facebook | ✅                 | HTTPS redirect URI required; app must be Live for non-role accounts. |
| Apple    | ❌ **no**          | Must be a real domain — use the hosts alias below.                   |

For Apple, `pnpm setup:hosts` prints the `/etc/hosts` entry (`127.0.0.1 rexstaples.local`) and
`pnpm setup:certs` already includes `rexstaples.local` in the certificate. Register
`https://rexstaples.local:3000/api/auth/callback/apple` with Apple.

**Apple's `AUTH_APPLE_SECRET` is not the `.p8` key.** It is a JWT signed with it that **expires every
6 months** — rotation is required or sign-in fails silently. See `.env.example`.

#### Development secret

Auth.js refuses to start without a secret, including for `/login` and `/api/auth/providers`. A
clearly-labelled, fixed development secret is used when `AUTH_SECRET` is unset; **production builds
still require a real one** and will fail without it.

### 2. TLS trust for Node processes: use `NODE_USE_SYSTEM_CA=1`

Preferred mechanism. Node 24 can read the macOS keychain — the same store Chrome and Safari use —
so mkcert certificates just work with **no CA path and no per-machine configuration**:

```bash
NODE_USE_SYSTEM_CA=1 node script.mjs   # or the flag: node --use-system-ca
```

Every workspace entry point sets it (`pnpm dev`, `pnpm dev:http`, `pnpm setup:certs`), and it
propagates through pnpm scripts. New tooling should either be invoked through those scripts or set
the variable itself.

| Mechanism                        | Result                                             |
| -------------------------------- | -------------------------------------------------- |
| `NODE_USE_SYSTEM_CA=1`           | ✅ reads the keychain — nothing else needed        |
| `NODE_EXTRA_CA_CERTS=<ca>`       | ✅ works; needs the CA path per process            |
| `--use-openssl-ca`               | ❌ OpenSSL does **not** read the macOS keychain    |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | ⚠️ works, but disables verification for everything |

`scripts/dev-ca.mjs` resolves a concrete CA path as a fallback for anything started without the
flag, so both mechanisms are covered. A `NODE_EXTRA_CA_CERTS` already in the environment is never
overridden.

### 3. GraphQL has three transports with different caching and proxy behaviour

| Transport                 | Caching               | Proxy notes                                  |
| ------------------------- | --------------------- | -------------------------------------------- |
| HTTP `POST /graphql`      | normal HTTP semantics | works through the current proxy unchanged    |
| HTTP `GET` (persisted)    | CDN-friendly          | fine                                         |
| **Subscriptions over WS** | none, long-lived      | needs upgrade tunnelling (already supported) |

Guidance:

- Use HTTP for queries/mutations. Avoid cache-busting query strings; they defeat CDN caching.
- For subscriptions use the `graphql-transport-ws` subprotocol. Upgrades are already tunnelled, but
  note that **`next dev`'s own HMR socket and a subscription socket share the same origin** — keep
  their paths distinct (`/_next/hmr` vs e.g. `/graphql`).
- Run codegen (`@graphql-codegen/*`) against the **schema**, not the local dev origin, or include
  the CA. Prefer a committed schema snapshot so codegen does not depend on a running service.

### 4. Note: `DASHBOARD_ORIGIN` default changed to HTTP

The HTTP fallback (`pnpm dev:http`) uses `rewrites()` to `http://localhost:3001`. If you ever set
`DASHBOARD_ORIGIN` to an `https://` value, `rewrites()` will reject the certificate — use the TLS
proxy (`pnpm dev`) for HTTPS, not `rewrites()`.

### 5. Proxy limitations that are fine now, and when they stop being fine

The proxy is deliberately minimal: HTTP/1.1, no compression rewriting, no response streaming
optimisation, no multiplexing. That is fine for HTML, JSON and HMR.

It stops being fine when you add:

- **Large file uploads / downloads** (no streaming tuning; fine at dev scale)
- **Server-Sent Events** (works — plain HTTP streaming — but no upstream keep-alive handling)
- **HTTP/2 or HTTP/3 features** (not negotiated)

At that point, replace `scripts/tls-proxy.mjs` with a real reverse proxy (Caddy or nginx) and keep
the same ports, paths and `basePath`. Nothing else in the workspace changes.

### 6. Certificate lifetime

mkcert leaf certs last ~2.3 years. `pnpm setup:certs -- --force` regenerates. After regenerating,
**restart every process** — long-lived Node processes cache the CA at startup.

## Browser support

| Browser | Trust mechanism                                                  |
| ------- | ---------------------------------------------------------------- |
| Chrome  | system keychain (mkcert installs it)                             |
| Safari  | system keychain                                                  |
| Firefox | enterprise policy written by `setup-certs.mjs` (own trust store) |

Firefox ignores the system store by default. `scripts/setup-certs.mjs` writes
`~/Library/Application Support/Mozilla/ManagedPolicies/policies.json` with
`Certificates.ImportEnterpriseRoots: true` when Firefox is installed. Restart Firefox after the
first run.

## Verification commands

```bash
# TLS terminates and the chain validates
echo | openssl s_client -connect localhost:3000 -servername localhost -CAfile "$(mkcert -CAROOT)/rootCA.pem" 2>&1 | grep 'Verify return code'

# Both apps answer through the single origin
for p in / /resume /dashboard; do
  curl -s --cacert "$(mkcert -CAROOT)/rootCA.pem" -o /dev/null -w "$p %{http_code}\n" "https://localhost:3000$p"
done

# HMR websocket upgrades
# (expect: HTTP/1.1 101 Switching Protocols)
```

## Speed principle

Prefer **one origin, relative URLs, no CORS, no duplicated auth logic**. Every absolute URL or
second origin adds a place for auth, cookies and subscriptions to break independently.
