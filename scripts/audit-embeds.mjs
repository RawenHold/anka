import { readFile, writeFile } from 'node:fs/promises';
const catalog = JSON.parse(await readFile('src/data/channel-catalog.json', 'utf8'));
const videos = catalog.videos.filter((video) => /^[\w-]{11}$/u.test(video.id));
let next = 0;
const blocked = [], unavailable = [], errors = [];
async function worker() {
  while (next < videos.length) {
    const video = videos[next++];
    const url = new URL('https://www.youtube.com/oembed');
    url.searchParams.set('url', `https://www.youtube.com/watch?v=${video.id}`);
    url.searchParams.set('format', 'json');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (response.status === 401) blocked.push(video.id);
      else if (response.status === 404 || response.status === 410) unavailable.push(video.id);
      else if (!response.ok) errors.push({ id: video.id, status: response.status });
    } catch { errors.push({ id: video.id, status: 'network' }); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
if (errors.length) {
  console.error(`Не проверено: ${errors.length}. Предыдущий список не изменён.`);
  console.error(JSON.stringify(errors));
  process.exitCode = 1;
} else {
  await writeFile('src/data/embed-availability.json', JSON.stringify({ checkedAt: new Date().toISOString(), checked: videos.length, blocked: blocked.sort(), unavailable: unavailable.sort() }, null, 2) + '\n');
  console.log(`Проверено: ${videos.length}; запрет встраивания: ${blocked.length}; недоступны: ${unavailable.length}.`);
}
