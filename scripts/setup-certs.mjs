/**
 * Generates locally-trusted HTTPS certificates for development.
 *
 * Uses mkcert, which creates a local CA, installs it in the system trust store
 * (Chrome + Safari) and issues a leaf certificate for localhost. Node does NOT
 * read the system store, so the TLS terminator passes the CA explicitly via
 * `NODE_EXTRA_CA_CERTS` — see `scripts/dev.mjs`.
 *
 * Firefox keeps its own trust store, so this also writes an enterprise policy
 * enabling `Certificates.ImportEnterpriseRoots` when Firefox is installed.
 *
 *   pnpm setup:certs              # (re)generate certs for localhost
 *   pnpm setup:certs -- --force   # overwrite existing files
 *
 * For Sign in with Apple an extra host alias is required: `pnpm setup:hosts`.
 *
 * Requirement: `brew install mkcert` (and once, `mkcert -install`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem');
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem');

/**
 * Hostnames the certificate must cover.
 *
 * `rexstaples.local` exists for Sign in with Apple, which rejects `localhost` as a
 * redirect URI. It requires a hosts alias (see `scripts/setup-hosts.mjs`).
 */
const HOSTS = ['localhost', '*.localhost', 'rexstaples.local', '127.0.0.1', '::1'];

const FIREFOX_APPS = ['/Applications/Firefox.app', '/Applications/Firefox Developer Edition.app'];
const FIREFOX_POLICY_DIR = path.join(
  os.homedir(),
  'Library/Application Support/Mozilla/ManagedPolicies',
);

const force = process.argv.includes('--force');

function fail(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function has(binary) {
  return spawnSync('which', [binary], { stdio: 'ignore' }).status === 0;
}

/** Make Firefox honour the system trust store (it keeps its own by default). */
function configureFirefox() {
  if (!FIREFOX_APPS.some((app) => existsSync(app))) {
    console.log('  ℹ Firefox not installed — skipping Firefox trust policy.');
    return;
  }

  const target = path.join(FIREFOX_POLICY_DIR, 'policies.json');

  try {
    mkdirSync(FIREFOX_POLICY_DIR, { recursive: true });

    let policy = {};
    if (existsSync(target)) {
      policy = JSON.parse(readFileSync(target, 'utf8'));
    }
    policy.policies ??= {};
    policy.policies.Certificates ??= {};
    policy.policies.Certificates.ImportEnterpriseRoots = true;

    writeFileSync(target, `${JSON.stringify(policy, null, 2)}\n`);
    console.log(`  ✓ Firefox policy set: ${target.replace(os.homedir(), '~')}`);
    console.log('    Restart Firefox for it to take effect.');
  } catch {
    console.log(`  ⚠ Could not write ${target}`);
    console.log('    Set security.enterprise_roots.enabled = true in about:config instead.');
  }
}

if (!has('mkcert')) {
  fail('mkcert is not installed. Run: brew install mkcert && mkcert -install');
}

// Ensure the local CA exists and is trusted by the system (Chrome + Safari).
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

configureFirefox();

const caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim();
console.log(`\n  CA root:  ${caRoot}`);
console.log('  Chrome + Safari trust it via the system store.');
console.log('  Node does not read the system store — dev.mjs passes it explicitly.\n');
