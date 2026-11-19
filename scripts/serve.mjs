import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveChannelMiddleware, startChannelRefresh } from './channel-refresh.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
try { if (!(await stat(resolve(dist, 'index.html'))).isFile()) throw new Error(); }
catch { throw new Error('No dist/index.html: run npm run build first.'); }

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const live = liveChannelMiddleware(root);

async function sendStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const file = resolve(dist, requested);
  const within = relative(dist, file);
  if (!within || within.startsWith('..') || isAbsolute(within)) { res.writeHead(403); res.end(); return; }
  let info;
  try { info = await stat(file); if (!info.isFile()) throw new Error(); }
  catch { res.writeHead(404); res.end(); return; }
  const headers = { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

const server = createServer((req, res) => live(req, res, () => { void sendStatic(req, res); }));
const stopRefresh = startChannelRefresh({ projectRoot: root });
server.on('close', stopRefresh);
server.listen(port, host, () => console.log(`ANKA: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`));
