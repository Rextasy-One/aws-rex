/**
 * One-host HTTPS development.
 *
 *   https://localhost:3000            marketing app (splash, /resume)
 *   https://localhost:3000/dashboard  the dashboard app
 *
 * Three processes:
 *   1. dashboard     next dev on :3001           (basePath /dashboard)
 *   2. marketing     next dev on :3002           (proxy target for the dashboard)
 *   3. tls-proxy     serves HTTPS on :3000 and routes by path
 *
 * Run `pnpm setup:certs` first (needs `brew install mkcert`). See README.md.
 *
 * Why not Next's `rewrites()` for the dashboard? It fetches an HTTPS destination
 * with global `fetch`, which has no custom-CA hook, and Node ignores the system
 * trust store. Keeping the upstreams on HTTP loopback and terminating TLS once in
 * `tls-proxy.mjs` sidesteps that entirely.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');

const TLS_PORT = process.env.MARKETING_PORT ?? '3000';
const DASHBOARD_PORT = process.env.DASHBOARD_PORT ?? '3001';
const MARKETING_PORT = process.env.MARKETING_UPSTREAM_PORT ?? '3002';

for (const file of ['localhost.pem', 'localhost-key.pem']) {
  if (!existsSync(path.join(CERT_DIR, file))) {
    console.error(`\n  ✖ Missing certs/${file}\n\n    Run: pnpm setup:certs\n`);
    process.exit(1);
  }
}

const children = [];

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('exit', (code) => {
    console.log(`  ${name} exited (${code})`);
    shutdown();
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 1. Dashboard, mounted under /dashboard.
run('dashboard', 'pnpm', ['--filter', '@aws-rex/dashboard', 'dev'], {
  NEXT_PUBLIC_BASE_PATH: '/dashboard',
  PORT: DASHBOARD_PORT,
});

// 2. Marketing app (HTTP; the TLS proxy fronts it).
run('marketing', 'pnpm', ['--filter', '@aws-rex/marketing-site', 'dev'], {
  PORT: MARKETING_PORT,
});

// 3. TLS terminator on the origin the browser visits.
run('tls-proxy', 'node', ['scripts/tls-proxy.mjs'], {
  MARKETING_PORT: TLS_PORT,
  MARKETING_UPSTREAM: `http://127.0.0.1:${MARKETING_PORT}`,
  DASHBOARD_UPSTREAM: `http://127.0.0.1:${DASHBOARD_PORT}`,
});

console.log(`\n  → https://localhost:${TLS_PORT}\n`);
