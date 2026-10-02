/**
 * Reports which OAuth providers are configured.
 *
 *   pnpm auth:doctor
 *
 * Reads process env plus `source/marketing-site/.env.local` if present, so it
 * works without exporting anything. Exits non-zero only when NO provider is
 * configured, which makes it usable as a CI smoke check.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_LOCAL = path.join(ROOT, 'source/marketing-site/.env.local');

const PROVIDERS = [
  { name: 'Google', keys: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'], callback: 'google' },
  { name: 'Facebook', keys: ['AUTH_FACEBOOK_ID', 'AUTH_FACEBOOK_SECRET'], callback: 'facebook' },
  { name: 'Apple', keys: ['AUTH_APPLE_ID', 'AUTH_APPLE_SECRET'], callback: 'apple' },
];

/** Minimal .env parser; `.env.local` is not loaded by this script otherwise. */
function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return {};
  const env = {};
  for (const line of readFileSync(ENV_LOCAL, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && match[2] && !match[2].startsWith('#')) env[match[1]] = match[2];
  }
  return env;
}

const fileEnv = loadEnvLocal();
const get = (key) => process.env[key] ?? fileEnv[key];

const origin = get('AUTH_URL') ?? 'https://localhost:3000';

console.log(`\n  OAuth providers  (origin: ${origin})\n`);

let configured = 0;

for (const provider of PROVIDERS) {
  const missing = provider.keys.filter((key) => !get(key));
  const ok = missing.length === 0 && Boolean(get('AUTH_SECRET'));
  if (ok) configured += 1;

  const mark = ok ? '✓' : '·';
  console.log(`  ${mark} ${provider.name}`);
  if (!ok) {
    if (!get('AUTH_SECRET')) console.log('      missing AUTH_SECRET (openssl rand -base64 32)');
    if (missing.length) console.log(`      missing ${missing.join(', ')}`);
  }
  console.log(`      redirect URI: ${origin}/api/auth/callback/${provider.callback}`);
  if (provider.name === 'Apple') {
    console.log('      Apple rejects localhost — use a hosts alias, see .env.example');
  }
}

console.log(
  `\n  ${configured} of ${PROVIDERS.length} providers configured.` +
    (configured === 0
      ? '\n  Copy .env.example to .env.local, then follow TODO.md to create the OAuth client.\n'
      : '\n'),
);

process.exit(configured === 0 ? 1 : 0);
