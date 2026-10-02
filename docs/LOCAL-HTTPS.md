# Local HTTPS development

One HTTPS origin, two apps, no asset collisions.

```
https://localhost:3000            → marketing app      (next dev on :3002)
https://localhost:3000/dashboard  → dashboard app      (next dev on :3001, basePath /dashboard)
                                    ^ TLS terminates on a tiny proxy (:3000)
```

## First run

```bash
brew install mkcert   # once
pnpm setup:certs      # once per machine; regenerate with `pnpm setup:certs -- --force`
pnpm dev
```

## Why certificates are needed at all

Chrome (and Safari) will happily show a warning for a self-signed cert, but several things break
silently: secure-context APIs, service workers, cookies marked `Secure`, and mixed-content rules.
A locally-trusted CA avoids all of it.

## How trust works (the important part)

`mkcert` does two things:

1. Creates a local CA at `$(mkcert -CAROOT)` and **installs it into the system trust store**.
   Chrome and Safari use the system store, so they trust every cert mkcert issues.
2. Issues a leaf certificate for `localhost`, `*.localhost`, `127.0.0.1`, `::1`.

**Node does not use the system trust store.** Measured on this machine:

| Consumer                                    | Result                               |
| ------------------------------------------- | ------------------------------------ |
| Chrome / Safari (system keychain)           | ✅ trusted                           |
| Firefox (if `ImportEnterpriseRoots` is on)  | ✅ trusted                           |
| Node with default trust                     | ❌ `UNABLE_TO_VERIFY_LEAF_SIGNATURE` |
| Node with `NODE_EXTRA_CA_CERTS=<mkcert CA>` | ✅ `200`                             |

Safari uses the system keychain and needs nothing extra. Firefox keeps its own store, so
`scripts/setup-certs.mjs` writes an enterprise policy (per-user
`~/Library/Application Support/Mozilla/NativeMessagingHosts`-adjacent `org.mozilla.firefox` policy)
setting `Certificates.ImportEnterpriseRoots` when Firefox is installed. That makes Firefox honour
the system store without hand-importing the CA.

That single fact dictates the architecture: because Node's `fetch` (used by Next `rewrites`) has no
custom-CA hook, an HTTPS destination cannot be proxied reliably from `next.config.ts`. Instead the
upstreams stay on **HTTP loopback** — nothing to verify — and TLS terminates once, in
`scripts/tls-proxy.mjs`, on the origin the browser actually visits.

## scripts

| Script                    | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `scripts/setup-certs.mjs` | `pnpm setup:certs` — install/refresh the CA and leaf certs |
| `scripts/dev.mjs`         | `pnpm dev` — dashboard + marketing + TLS proxy             |
| `scripts/dev-http.mjs`    | `pnpm dev:http` — same topology, no TLS                    |
| `scripts/tls-proxy.mjs`   | HTTPS terminator; routes `/dashboard/*` to the dashboard   |

Certificates live in `certs/` and are gitignored. They are re-created by `pnpm setup:certs`.

## Ports

| Port | Process                             |
| ---- | ----------------------------------- |
| 3000 | TLS proxy (the origin you visit)    |
| 3001 | dashboard `next dev` (basePath set) |
| 3002 | marketing `next dev`                |

## Why `basePath` on the dashboard

Every Next app claims `/_next/*` for its assets. Two apps on one origin therefore collide: the
dashboard's CSS and chunks 404 because the marketing server answers `/_next/*` from its own build.
Starting the dashboard with `NEXT_PUBLIC_BASE_PATH=/dashboard` relocates its assets to
`/dashboard/_next/*`, which is namespaced and collision-free.

## Known limitations

The TLS proxy is deliberately minimal:

- **WebSocket upgrades are supported** (HMR works). `/_next/hmr` tunnels to the owning app; both
  apps answer `101 Switching Protocols`.
- **HTTP/1.1 only.** No HTTP/2 ALPN.
- **No compression rewriting or response streaming tuning.** Fine for HTML/JSON/HMR.
- **Cert expiry.** mkcert leaf certs last ~2.3 years; `pnpm setup:certs -- --force` regenerates.
  Restart all processes afterwards (they cache the CA at startup).

See [`DEV-ENVIRONMENT.md`](./DEV-ENVIRONMENT.md) for the OAuth/GraphQL implications, and for when to
replace this proxy with Caddy or nginx.

For work that needs real HMR or is not TLS-sensitive, `pnpm dev:http` is simpler.
