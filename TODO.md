# TODO

Things that need a **person with an account, a credential, or a decision** — the work that cannot be
done by editing this repository. Everything here is blocked on something outside the codebase, which
is why it lives in one list instead of inside the docs that describe the systems.

Engineering backlog (work that _is_ just code) is in [`ROADMAP.md`](./ROADMAP.md).

---

## Register OAuth clients

The auth scaffold is complete; providers stay disabled until these exist. Run `pnpm auth:doctor` at
any time to see what is still missing.

**Start with Google — it is the only one with no blocking constraint for development.**

### Google — unblocks "Continue with Google"

- [ ] Create a GCP project (or pick one)
- [ ] OAuth consent screen → User type **External**, set app name + support email
- [ ] Audience → **Test users** → add your Google account _(without this, sign-in is refused)_
- [ ] Credentials → Create credentials → **OAuth client ID** → Web application
- [ ] Authorized redirect URI, exactly:
      `https://localhost:3000/api/auth/callback/google`
- [ ] Put in `source/marketing-site/.env.local`:
      `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- [ ] `pnpm auth:doctor` → expect `1 of 3 providers configured`
- [ ] Sign in at https://localhost:3000/login and confirm a session is created

**Scope needed: `openid profile email` only — no Google verification review required.**

> ⚠️ While the consent screen is in **Testing**, Google expires refresh tokens after **7 days** and
> caps test users at 100. Expect weekly silent logouts and `invalid_grant` errors. Before real
> users: OAuth consent screen → **Publish App**. That removes the 7-day TTL immediately; the
> "unverified app" warning stays until verification completes.

### Facebook — deliberately stubbed

- [ ] Meta for Developers → Create app → add **Facebook Login** product
- [ ] Valid OAuth Redirect URIs: `https://localhost:3000/api/auth/callback/facebook`
- [ ] App must be **Live** for accounts without an app role _(Development mode limits sign-in to
      app-role accounts only)_
- [ ] Set `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`

**Extra friction:** production use needs app review for `public_profile`/`email`.

### Apple — deliberately stubbed, highest cost

- [ ] Paid **Apple Developer Program** membership (~$99/yr) — no free path
- [ ] App ID + **Services ID** (the Services ID is the OAuth `client_id`)
- [ ] Register a return URL. **Apple rejects `localhost`.** Use the hosts alias:
      `pnpm setup:hosts` prints the `/etc/hosts` line (`127.0.0.1 rexstaples.local`), and
      `pnpm setup:certs` already covers `rexstaples.local` in the certificate
- [ ] Register `https://rexstaples.local:3000/api/auth/callback/apple`
- [ ] Create a **`.p8` key** and generate `AUTH_APPLE_SECRET`:
      `npx auth add apple --generate-secret`

> ⚠️ `AUTH_APPLE_SECRET` is **not** the `.p8` file. It is a JWT signed with it that **expires every
> 6 months**. Rotation is mandatory or sign-in fails silently. Budget for automating this before
> relying on Apple sign-in.

---

## Decisions still open

- [ ] **Production topology for the dashboard.** Dev is settled (marketing on 3000 proxies
      `/dashboard`). Production needs a decision: one host with path routing, or separate origins.
      See `ROADMAP.md` item 7.
- [ ] **Publish the shared packages.** Local linking covers development. Publishing to the AWS
      private registry (CodeArtifact) is deferred. See `docs/TOOLING.md`.
- [ ] **Brand mark compliance.** The login buttons compose the vendor glyphs. Google and Apple both
      publish official button assets with their own colour/size rules that a composed button may not
      satisfy. Relevant only if a provider enforces it.
- [ ] **Rotate the development `AUTH_SECRET`.** A fixed, clearly-labelled dev secret is used when
      unset so auth routes work locally. Production requires a real one and fails without it — verify
      that before the first deploy.

---

## Nothing here blocks local development

The workspace runs, builds, and passes `pnpm check` with **zero** OAuth credentials configured. The
login page renders each unconfigured provider with the exact env vars it needs.
