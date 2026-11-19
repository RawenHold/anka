// Import metadata previously exported by yt-dlp; never download video media.
// Run from the project root after installing yt-dlp separately:
// yt-dlp --flat-playlist --dump-single-json "https://www.youtube.com/playlist?list=UUmLSYJkWLEbcrF4By3StTvQ" > flat.json
// yt-dlp --dump-json --skip-download --ignore-errors "https://www.youtube.com/playlist?list=UUmLSYJkWLEbcrF4By3StTvQ" > full.jsonl
// node scripts/import-channel-catalog.mjs flat.json full.jsonl
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const channelId = 'UCmLSYJkWLEbcrF4By3StTvQ';
const playlistId = 'UUmLSYJkWLEbcrF4By3StTvQ';
const [flatPath, fullPath] = process.argv.slice(2);
if (!flatPath || !fullPath) throw new Error('Укажите пути к flat.json и full.jsonl');
const clean = text => text.replace(/^\uFEFF/, '').replace(/\0/g, '');
const flat = JSON.parse(clean(readFileSync(flatPath, 'utf8')));
const full = clean(readFileSync(fullPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
if (flat.channel_id !== channelId || !Array.isArray(flat.entries) || !flat.entries.length) throw new Error('Плейлист не принадлежит ожидаемому каналу или пуст');
const byId = new Map();
for (const video of full) {
  if (video.channel_id !== channelId || !/^[\w-]{11}$/.test(video.id) || byId.has(video.id)) throw new Error(`Неверная или повторная запись: ${video.id}`);
  byId.set(video.id, video);
}
const ids = flat.entries.map(video => video.id);
if (new Set(ids).size !== ids.length || byId.size !== ids.length || ids.some(id => !byId.has(id))) throw new Error('Список и метаданные не совпадают; каталог не записан');
const videos = ids.map(id => {
  const video = byId.get(id);
  const date = video.upload_date;
  return {
    id, title: video.title, date: /^\d{8}$/.test(date || '') ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : null,
    durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
    description: typeof video.description === 'string' ? video.description : null,
    url: `https://www.youtube.com/watch?v=${id}`,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  };
});
const catalog = {
  channel: { id: channelId, handle: '@anka-dalnoboi', url: `https://www.youtube.com/channel/${channelId}` },
  source: { playlistId, url: `https://www.youtube.com/playlist?list=${playlistId}`, retrievedAt: new Date().toISOString(), method: 'yt-dlp flat playlist and individual video metadata', scope: 'Accessible public uploads returned by this playlist; private, deleted, unavailable, unlisted or other channel content may be absent.', playlistEntries: ids.length, metadataEntries: videos.length },
  videos
};
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/channel-catalog.json', JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`Импортировано ${videos.length} записей.`);
