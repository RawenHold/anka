import catalog from './channel-catalog.json' with { type: 'json' };

const archivedIds = new Set(catalog.videos.map((video) => video.id));
const musicCue = /🎵|🎶|музык|песн|композиц|саундтрек|\bmusic\b|\bsong\b|\btrack\b/iu;
const timePattern = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/u;

function platformFor(url, context) {
  const host = url.hostname.toLowerCase();
  if (['suno.com', 'www.suno.com'].includes(host) && /^\/(s|song)\/[\w-]+\/?$/u.test(url.pathname)) return 'Suno';
  if (host === 'open.spotify.com' && /^\/track\/[\w]+/u.test(url.pathname)) return 'Spotify';
  if (host === 'music.apple.com' && /\/(song|album)\//u.test(url.pathname)) return 'Apple Music';
  if (host === 'music.youtube.com' && url.pathname === '/watch' && /^[\w-]{11}$/u.test(url.searchParams.get('v') || '')) return 'YouTube';
  if (musicCue.test(context) && ((host === 'youtu.be' && /^\/[\w-]{11}\/?$/u.test(url.pathname)) || (['youtube.com', 'www.youtube.com'].includes(host) && url.pathname === '/watch' && /^[\w-]{11}$/u.test(url.searchParams.get('v') || '')))) return 'YouTube';
  return null;
}

// Only new videos: the archived releases already have a reviewed music index.
export function extractLiveMusic(video) {
  if (!video || archivedIds.has(video.id) || typeof video.sourceDescription !== 'string') return [];
  const lines = video.sourceDescription.replace(/\r\n?/gu, '\n').split('\n');
  const tracks = [];
  const seen = new Set();
  lines.forEach((line, index) => {
    const previous = lines[index - 1] || '';
    const context = `${/https?:\/\//iu.test(previous) ? '' : previous} ${line}`;
    for (const match of line.matchAll(/https?:\/\/[^\s<>"']+/giu)) {
      let url;
      try { url = new URL(match[0].replace(/[),.;!?\]}]+$/u, '')); } catch { continue; }
      if (url.protocol !== 'https:') continue;
      const platform = platformFor(url, context);
      if (!platform) continue;
      const sameTime = line.slice(0, match.index).match(timePattern)?.[1] || null;
      const previousTime = (lines[index - 1] || '').trim().match(timePattern)?.[1] || null;
      const time = sameTime || previousTime;
      const key = `${url.href}|${time || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const mention = { videoId: video.id, videoTitle: video.title, time, timeIsApproximate: Boolean(!sameTime && previousTime) };
      tracks.push({ id: `live-${video.id}-${index}-${tracks.length}`, title: 'Музыка из выпуска', artist: null, platform, listenUrl: url.href, artwork: null, mentions: [mention] });
    }
  });
  return tracks;
}
