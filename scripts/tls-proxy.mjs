/**
 * TLS terminator for one-host HTTPS development.
 *
 *   https://localhost:3000            → marketing app      (http://127.0.0.1:3002)
 *   https://localhost:3000/dashboard  → dashboard app      (http://127.0.0.1:3001, basePath /dashboard)
 *
 * Why a proxy instead of Next's `rewrites()`: Next fetches an HTTPS destination
 * with global `fetch`, which has no hook for a custom CA. Node ignores the system
 * trust store, so a self-signed/mkcert origin would fail verification. Here the
 * upstreams stay HTTP on loopback (nothing to verify) and TLS terminates once, on
 * the origin the browser actually visits.
 *
 * Nothing outside loopback can reach the HTTP upstreams.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');

const TLS_PORT = Number(process.env.MARKETING_PORT ?? 3000);
const MARKETING_UPSTREAM = process.env.MARKETING_UPSTREAM ?? 'http://127.0.0.1:3002';
const DASHBOARD_UPSTREAM = process.env.DASHBOARD_UPSTREAM ?? 'http://127.0.0.1:3001';

// Requests under this prefix belong to the dashboard app.
const DASHBOARD_PREFIX = '/dashboard';

const cert = fs.readFileSync(path.join(CERT_DIR, 'localhost.pem'));
const key = fs.readFileSync(path.join(CERT_DIR, 'localhost-key.pem'));

/** Hop-by-hop headers must not be forwarded (RFC 9110 §7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function pickUpstream(pathname) {
  const isDashboard = pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
  return isDashboard ? DASHBOARD_UPSTREAM : MARKETING_UPSTREAM;
}

/** WebSocket upgrades (HMR) are not implemented; fail clearly rather than hang. */
function onUpgrade(_req, socket) {
  socket.write('HTTP/1.1 501 Not Implemented\r\nConnection: close\r\n\r\n');
  socket.destroy();
}

const server = https.createServer({ cert, key }, async (req, res) => {
  const upstream = pickUpstream(new URL(req.url ?? '/', 'https://localhost').pathname);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-host', req.headers.host ?? `localhost:${TLS_PORT}`);
  headers.set('x-forwarded-proto', 'https');

  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';

  try {
    const upstreamRes = await fetch(upstream + req.url, {
      method,
      headers,
      body: hasBody ? req : undefined,
      // @ts-expect-error -- Node's fetch requires this to stream a request body
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    });

    res.writeHead(upstreamRes.status, Object.fromEntries(upstreamRes.headers));
    if (upstreamRes.body) {
      for await (const chunk of upstreamRes.body) res.write(chunk);
    }
    res.end();
  } catch (error) {
    const code = error?.cause?.code ?? error?.code ?? 'UNKNOWN';
    console.error(`[tls-proxy] ${method} ${req.url} → ${upstream} failed: ${code}`);
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Bad gateway: ${upstream} unreachable (${code})\n`);
  }
});

server.on('upgrade', onUpgrade);

server.listen(TLS_PORT, '127.0.0.1', () => {
  console.log(`  TLS proxy → https://localhost:${TLS_PORT}`);
  console.log(`    ${DASHBOARD_PREFIX}/*  → ${DASHBOARD_UPSTREAM}`);
  console.log(`    /*          → ${MARKETING_UPSTREAM}`);
});
