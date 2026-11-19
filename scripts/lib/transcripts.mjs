// Public YouTube captions are optional and may be unavailable. No video/audio is downloaded.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_PAGE_CHARS = 10_000_000;
const MAX_CAPTION_CHARS = 5_000_000;

// Extract only a JSON object from a script assignment; never evaluate page code.
export function parsePlayerResponse(html, videoId) {
  if (typeof html !== 'string' || !VIDEO_ID.test(videoId) || html.length > MAX_PAGE_CHARS) return null;
  const assignment = /(?:\bvar\s+)?ytInitialPlayerResponse\s*=\s*\{/gu;
  for (const match of html.matchAll(assignment)) {
    const start = match.index + match[0].lastIndexOf('{');
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < html.length; index += 1) {
      const char = html[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const player = JSON.parse(html.slice(start, index + 1));
            if (player?.videoDetails?.videoId === videoId) return player;
          } catch { /* A different script fragment is not a valid player response. */ }
          break;
        }
      }
    }
  }
  return null;
}

function decodeXmlText(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (entity, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, code.toLowerCase())) return named[code.toLowerCase()];
    const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}

export function parseCaptionText(payload) {
  if (typeof payload !== 'string' || !payload.trim() || payload.length > MAX_CAPTION_CHARS) return [];
  const cues = [];
  try {
    const json = JSON.parse(payload);
    if (!Array.isArray(json?.events)) return [];
    for (const event of json.events) {
      if (!Number.isFinite(event?.tStartMs) || event.tStartMs < 0 || !Array.isArray(event.segs)) continue;
      const text = event.segs.map((part) => typeof part?.utf8 === 'string' ? part.utf8 : '').join('').replace(/\s+/gu, ' ').trim();
      if (text) cues.push({ timeSeconds: Math.floor(event.tStartMs / 1000), text });
    }
    return cues;
  } catch { /* Some public tracks use timed-text XML instead of JSON3. */ }
  for (const match of payload.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text\s*>/giu)) {
    const start = match[1].match(/\bstart\s*=\s*["'](\d+(?:\.\d+)?)["']/iu);
    if (!start) continue;
    const text = decodeXmlText(match[2].replace(/<[^>]*>/gu, '')).replace(/\s+/gu, ' ').trim();
    if (text) cues.push({ timeSeconds: Math.floor(Number(start[1])), text });
  }
  return cues;
}

function allowedTrackUrl(value, videoId) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname !== 'www.youtube.com' && url.hostname !== 'youtube.com') return null;
    if (url.pathname !== '/api/timedtext' || url.searchParams.get('v') !== videoId) return null;
    url.searchParams.set('fmt', 'json3');
    return url;
  } catch { return null; }
}

export async function getRussianCaptions(videoId, { fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  if (!VIDEO_ID.test(videoId) || typeof fetchImpl !== 'function') return [];
  const timeout = Math.max(100, Math.min(Number.isFinite(timeoutMs) ? timeoutMs : 10_000, 15_000));
  const request = () => ({ headers: { 'Accept-Language': 'ru-RU,ru;q=0.9' }, redirect: 'error', signal: AbortSignal.timeout(timeout) });
  try {
    const pageUrl = new URL('https://www.youtube.com/watch');
    pageUrl.searchParams.set('v', videoId);
    pageUrl.searchParams.set('hl', 'ru');
    const response = await fetchImpl(pageUrl.toString(), request());
    if (!response?.ok) return [];
    const html = await response.text();
    const player = parsePlayerResponse(html, videoId);
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks)) return [];
    const russianTracks = tracks.filter((track) => typeof track?.languageCode === 'string' && /^ru(?:-|$)/iu.test(track.languageCode));
    russianTracks.sort((a, b) => Number(a.kind === 'asr') - Number(b.kind === 'asr'));
    for (const track of russianTracks) {
      const url = allowedTrackUrl(track.baseUrl, videoId);
      if (!url) continue;
      try {
        const captions = await fetchImpl(url.toString(), request());
        if (!captions?.ok) continue;
        const cues = parseCaptionText(await captions.text());
        if (cues.length) return cues;
      } catch { /* Try another valid Russian track, if supplied. */ }
    }
  } catch { /* Captions are optional: retain the last verified odometer reading. */ }
  return [];
}
