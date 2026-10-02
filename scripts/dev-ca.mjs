/**
 * Dev CA resolution — imported by every workspace entry point.
 *
 * Problem: Node does not read the system trust store, so a locally-issued
 * certificate (mkcert) is rejected with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
 *
 * Preferred fix is `NODE_USE_SYSTEM_CA=1`, which makes Node 24 read the macOS
 * keychain directly — the same store Chrome and Safari use. No CA path, no
 * per-machine configuration. It is set per process, so this module resolves it to
 * a concrete CA path as a fallback for anything that starts Node without it.
 *
 * Resolution order:
 *   1. an existing NODE_EXTRA_CA_CERTS (never overridden)
 *   2. `mkcert -CAROOT`/rootCA.pem, if mkcert is on PATH
 *   3. the conventional macOS CARROOT location
 *
 *   import { caPath, hasLocalCa } from '../scripts/dev-ca.mjs';
 *
 * Deliberately NOT used: NODE_TLS_REJECT_UNAUTHORIZED=0, which disables
 * verification for every connection in the process rather than trusting one CA.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Conventional mkcert CAROOT on macOS, used when mkcert is not on PATH. */
const FALLBACK_CARROOT = path.join(os.homedir(), 'Library/Application Support/mkcert');

function fromMkcert() {
  try {
    const root = execFileSync('mkcert', ['-CAROOT'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return root ? path.join(root, 'rootCA.pem') : null;
  } catch {
    return null;
  }
}

function resolveCaPath() {
  if (process.env.NODE_EXTRA_CA_CERTS) return process.env.NODE_EXTRA_CA_CERTS;

  for (const candidate of [fromMkcert(), path.join(FALLBACK_CARROOT, 'rootCA.pem')]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

export const caPath = resolveCaPath();
export const hasLocalCa = Boolean(caPath);

if (caPath) {
  process.env.NODE_EXTRA_CA_CERTS = caPath;
}
