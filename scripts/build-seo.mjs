import { readFile, writeFile } from 'node:fs/promises';

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const catalog = JSON.parse(await readFile('src/data/channel-catalog.json', 'utf8'));
let liveVideos = [];
try {
  const live = JSON.parse(await readFile('public/data/channel-live.json', 'utf8'));
  if (live.channelId === catalog.channel.id && Array.isArray(live.videos)) liveVideos = live.videos;
} catch { /* The original archive remains available when no live snapshot exists. */ }
const byId = new Map();
for (const video of [...catalog.videos, ...liveVideos]) {
  if (/^[A-Za-z0-9_-]{11}$/.test(video.id || '') && typeof video.title === 'string' && video.title.trim()) byId.set(video.id, video);
}
const videos = [...byId.values()];
let html = await readFile('dist/index.html', 'utf8');
const archive = `<section><h2>Выпуски канала ANKA</h2><ul>${videos.map((video) => `<li><a href="https://www.youtube.com/watch?v=${video.id}">${escapeHtml(video.title)}</a></li>`).join('')}</ul></section>`;
html = html.replace('<!-- ANKA_ARCHIVE -->', archive);

if (process.env.SITE_URL) {
  const url = new URL(process.env.SITE_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('SITE_URL должен быть обычным адресом сайта без параметров');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const siteUrl = url.href;
  const image = new URL('images/research/anya-sergey-home.jpg', siteUrl).href;
  html = html.replace('</head>', `  <link rel="canonical" href="${escapeHtml(siteUrl)}" />\n  <meta property="og:url" content="${escapeHtml(siteUrl)}" />\n  <meta property="og:image" content="${escapeHtml(image)}" />\n  <meta name="twitter:image" content="${escapeHtml(image)}" />\n  </head>`);
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(siteUrl)}</loc></url></urlset>\n`);
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
}
await writeFile('dist/index.html', html);
console.log(`Поисковый HTML: ${videos.length} ссылок на выпуски${process.env.SITE_URL ? ', sitemap и canonical' : '; SITE_URL не задан, canonical и sitemap будут добавлены при публикации'}.`);
