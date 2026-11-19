import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const DEFAULT_INTERVAL = 60 * 60 * 1000;

// Called only by a running server. A build alone never starts network work.
export function startChannelRefresh({ projectRoot = process.cwd(), intervalMs = DEFAULT_INTERVAL, sync, onError = () => console.warn('ANKA: не удалось обновить данные канала; сохранён предыдущий снимок.') } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError('intervalMs must be positive');
  let stopped = false;
  let running = false;
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const update = sync || (await import(pathToFileURL(resolve(projectRoot, 'scripts/channel-sync.mjs')).href)).syncChannel;
      const result = await update();
      if (result && result.ok === false) onError();
    } catch {
      // Do not print URLs, tokens, or response bodies from failed network requests.
      onError();
    } finally {
      running = false;
    }
  };
  const first = setTimeout(run, 0);
  const interval = setInterval(run, intervalMs);
  first.unref?.();
  interval.unref?.();
  return () => { stopped = true; clearTimeout(first); clearInterval(interval); };
}

// Vite preview serves dist/ by default; this route serves the latest runtime snapshot.
export function liveChannelMiddleware(projectRoot = process.cwd(), read = readFile) {
  const file = resolve(projectRoot, 'public', 'data', 'channel-live.json');
  return async (req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/data/channel-live.json') return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    try {
      const body = await read(file);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      // Vite can still serve its bundled snapshot if no runtime file is available.
      return next();
    }
  };
}
