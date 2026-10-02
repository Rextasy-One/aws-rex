/**
 * Generates locally-trusted HTTPS certificates for development.
 *
 * Uses mkcert, which creates a local CA, installs it in the system trust store
 * (so Chrome trusts it) and issues a leaf certificate for localhost. Node does
 * NOT read the system store, so the proxy is given the CA explicitly via
 * `NODE_EXTRA_CA_CERTS` — see `scripts/dev.mjs`.
 *
 *   pnpm setup:certs        # (re)generate certs, default localhost/*.localhost
 *   pnpm setup:certs -- --force   # overwrite existing files
 *
 * Requirement: `brew install mkcert` (and once, `mkcert -install`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem');
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem');

/** Hostnames the certificate must cover. */
const HOSTS = ['localhost', '*.localhost', '127.0.0.1', '::1'];

const force = process.argv.includes('--force');

function fail(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function has(binary) {
  return spawnSync('which', [binary], { stdio: 'ignore' }).status === 0;
}

if (!has('mkcert')) {
  fail('mkcert is not installed. Run: brew install mkcert && mkcert -install');
}

// Ensure the local CA exists and is trusted by the system (Chrome/Safari).
// `mkcert -install` is a no-op when the CA is already present.
try {
  execFileSync('mkcert', ['-install'], { stdio: 'inherit' });
} catch {
  fail('`mkcert -install` failed. It may need your login password once.');
}

if (existsSync(CERT_FILE) && existsSync(KEY_FILE) && !force) {
  console.log(
    `  ℹ Certs already exist in ${path.relative(ROOT, CERT_DIR)}/ — pass -- --force to regenerate.`,
  );
} else {
  mkdirSync(CERT_DIR, { recursive: true });
  execFileSync('mkcert', ['-cert-file', CERT_FILE, '-key-file', KEY_FILE, ...HOSTS], {
    stdio: 'inherit',
  });
  console.log(`  ✓ Wrote ${path.relative(ROOT, CERT_FILE)} and ${path.relative(ROOT, KEY_FILE)}`);
}

const caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim();
console.log(`\n  CA root:  ${caRoot}`);
console.log('  Chrome trusts it via the system store.');
console.log('  Node does not read the system store — dev.mjs passes it explicitly.\n');
