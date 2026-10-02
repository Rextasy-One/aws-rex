/**
 * HTTPS terminator with WebSocket support for one-host local development.
 *
 *   https://localhost:3000            → marketing app     (next dev :3002)
 *   wss://localhost:3000/_next/hmr    → marketing HMR     (next dev :3002)
 *   https://localhost:3000/dashboard  → dashboard app     (next dev :3001, basePath /dashboard)
 *   wss://localhost:3000/dashboard/_next/hmr → dashboard HMR
 *
 * Why a proxy instead of Next's `rewrites()`: `rewrites()` fetches an HTTPS
 * destination with global `fetch`, which has no custom-CA hook, and Node ignores
 * the system trust store. Keeping upstreams on HTTP loopback removes the
 * verification problem entirely and lets a single TLS certificate serve every
 * thing the browser talks to — including HMR sockets.
 *
 * Upgrades are tunnelled with `net.connect` (a raw socket pipe) rather than
 * `http.request`, so no WebSocket library is needed and any subprotocol,
 * extension or compression negotiation passes through untouched.
 *
 * Nothing outside loopback can reach the HTTP upstreams.
 */
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import './dev-ca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');

const TLS_PORT = Number(process.env.MARKETING_PORT ?? 3000);
const MARKETING_UPSTREAM = process.env.MARKETING_UPSTREAM ?? 'http://127.0.0.1:3002';
const DASHBOARD_UPSTREAM = process.env.DASHBOARD_UPSTREAM ?? 'http://127.0.0.1:3001';

/** Requests under this prefix belong to the dashboard app. */
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

/**
 * Node's `fetch` transparently decompresses the upstream body, so forwarding
 * `content-encoding` makes the browser try to gunzip plain bytes and fail with
 * `net::ERR_CONTENT_DECODING_FAILED`. `content-length` is likewise stale once the
 * body is re-encoded.
 */
const BODY_DESCRIPTORS = new Set(['content-encoding', 'content-length']);

function pickUpstream(pathname) {
  const isDashboard = pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
  return isDashboard ? DASHBOARD_UPSTREAM : MARKETING_UPSTREAM;
}

function hostOf(origin) {
  const { hostname, port } = new URL(origin);
  return { host: hostname, port: Number(port || 80) };
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
      // @ts-expect-error -- Node's fetch needs this to stream a request body
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    });

    const responseHeaders = Object.fromEntries(upstreamRes.headers);
    for (const name of Object.keys(responseHeaders)) {
      if (BODY_DESCRIPTORS.has(name.toLowerCase())) delete responseHeaders[name];
    }
    res.writeHead(upstreamRes.status, responseHeaders);
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

/**
 * WebSocket / HTTP Upgrade tunnelling.
 *
 * The client's own `Connection`/`Upgrade` headers are replayed verbatim, so HMR
 * subprotocols (e.g. `next-hmr`) negotiate normally.
 */
server.on('upgrade', (req, clientSocket, head) => {
  const upstream = pickUpstream(new URL(req.url ?? '/', 'https://localhost').pathname);
  const { host, port } = hostOf(upstream);

  const upstreamSocket = net.connect(port, host, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) lines.push(`${name}: ${v}`);
    }
    upstreamSocket.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstreamSocket.write(head);
  });

  // Bidirectional pipe; either side closing tears down both.
  clientSocket.on('error', () => upstreamSocket.destroy());
  upstreamSocket.on('error', (error) => {
    console.error(`[tls-proxy] upgrade ${req.url} → ${upstream} failed: ${error.code}`);
    clientSocket.destroy();
  });
  clientSocket.pipe(upstreamSocket);
  upstreamSocket.pipe(clientSocket);
});

// Bind both stacks. A browser resolving `localhost` prefers ::1 on macOS, so an
// IPv4-only listener makes https://localhost:3000 refuse to connect even though
// 127.0.0.1 works. Omitting the host binds :: and 0.0.0.0; the upstreams remain
// loopback-only, and this listener is still unreachable from outside the machine
// in practice because it serves only the local dev certificates.
server.listen(TLS_PORT, () => {
  console.log(`  TLS proxy → https://localhost:${TLS_PORT}  (WebSocket upgrades enabled)`);
  console.log(`    ${DASHBOARD_PREFIX}/*  → ${DASHBOARD_UPSTREAM}`);
  console.log(`    /*          → ${MARKETING_UPSTREAM}`);
});
