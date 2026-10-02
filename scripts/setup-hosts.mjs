/**
 * Adds the local host alias required by Sign in with Apple.
 *
 *   pnpm setup:hosts
 *
 * Apple refuses `localhost` as a redirect URI, so development uses a real-looking
 * domain that resolves to loopback:
 *
 *   127.0.0.1 rexstaples.local
 *
 * Editing /etc/hosts needs sudo, so this script checks first and prints the exact
 * command rather than doing it silently. Re-running is safe (idempotent).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const HOST = 'rexstaples.local';
const IP = '127.0.0.1';
const HOSTS_FILE = '/etc/hosts';

let current = '';
try {
  current = readFileSync(HOSTS_FILE, 'utf8');
} catch {
  console.error(`\n  ✖ Cannot read ${HOSTS_FILE}\n`);
  process.exit(1);
}

const alreadyPresent = current
  .split('\n')
  .some((line) => !line.trim().startsWith('#') && line.split(/\s+/).includes(HOST));

if (alreadyPresent) {
  console.log(`\n  ✓ ${HOST} already maps to an address in ${HOSTS_FILE}\n`);
  process.exit(0);
}

const entry = `${IP} ${HOST}`;
console.log(`
  Sign in with Apple needs a non-localhost redirect URI.

  Add this line to ${HOSTS_FILE} (needs sudo):

      ${entry}

  Then restart the browser and re-run \`pnpm setup:certs -- --force\` so the
  certificate covers ${HOST}.

  Run it with:

      sudo sh -c 'echo "${entry}" >> ${HOSTS_FILE}'

  Verify afterwards with:

      dscacheutil -flushcache; ping -c1 ${HOST}
`);

// Flush the resolver cache if the entry was added by another means.
try {
  execFileSync('dscacheutil', ['-flushcache']);
} catch {
  // Non-fatal: the cache will expire on its own.
}

process.exit(1);
