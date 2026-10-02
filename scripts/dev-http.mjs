/**
 * HTTP development fallback (no certificates).
 *
 *   http://localhost:3000            marketing app
 *   http://localhost:3000/dashboard  the dashboard app (proxied by Next rewrites)
 *
 * Simpler than `pnpm dev`, but there is no TLS: secure-context APIs, cookies
 * marked `Secure` and OAuth redirect testing all behave differently. Use
 * `pnpm dev` for anything auth-related.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import './dev-ca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const DASHBOARD_PORT = process.env.DASHBOARD_PORT ?? '3001';
const MARKETING_PORT = process.env.MARKETING_PORT ?? '3000';

const children = [];

function run(name, args, env = {}) {
  const child = spawn('pnpm', args, {
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
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('dashboard', ['--filter', '@aws-rex/dashboard', 'dev'], {
  NEXT_PUBLIC_BASE_PATH: '/dashboard',
  PORT: DASHBOARD_PORT,
});

run('marketing', ['--filter', '@aws-rex/marketing-site', 'dev'], {
  DASHBOARD_ORIGIN: `http://localhost:${DASHBOARD_PORT}`,
  PORT: MARKETING_PORT,
});

console.log(`\n  → http://localhost:${MARKETING_PORT}\n`);
