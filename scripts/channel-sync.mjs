import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNEL_ID, parseFeed } from './lib/feed.mjs';
import { parseSubscriberPage } from './lib/subscribers.mjs';
import { extractMileageCandidate } from './lib/mileage.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_TARGET = path.join(ROOT, 'public', 'data', 'channel-live.json');
const DEFAULT_CATALOG = path.join(ROOT, 'src', 'data', 'channel-catalog.json');
const UPLOADS_ID = 'UUmLSYJkWLEbcrF4By3StTvQ';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const CHANNEL_URL = 'https://www.youtube.com/@anka-dalnoboi/about';
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/u;

function initialState() {
  return {
    schemaVersion: 1,
    channelId: CHANNEL_ID,
    lastCheckedAt: null,
    videoCheckedAt: null,
    videos: [],
    subscribers: { count: 193000, observedAt: '2026-11-17T00:00:00.000Z', source: 'snapshot' },
    mileage: { miles: 800000, asOf: '2026-09-27', videoId: 'AgAbY3alNxI', timeSeconds: 581, source: 'video' },
    mileageChecks: {},
  };
}

async function readState(targetFile) {
  let text;
  try { text = await readFile(targetFile, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return initialState(); throw error; }
  const state = JSON.parse(text);
  if (state.schemaVersion !== 1 || state.channelId !== CHANNEL_ID || !Array.isArray(state.videos)) throw new Error('Неверный файл сохранённых данных канала');
  return { ...initialState(), ...state, mileageChecks: state.mileageChecks && typeof state.mileageChecks === 'object' && !Array.isArray(state.mileageChecks) ? state.mileageChecks : {} };
}

async function baselineIds(catalogFile) {
  try {
    const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
    if (catalog?.channel?.id !== CHANNEL_ID || !Array.isArray(catalog.videos)) return new Set();
    return new Set(catalog.videos.map((video) => video.id).filter((id) => YOUTUBE_ID.test(id)));
  } catch { return new Set(); }
}

function validVideo(video) {
  return video && YOUTUBE_ID.test(video.id) && typeof video.title === 'string' && video.title.trim() && /^\d{4}-\d{2}-\d{2}$/u.test(video.date || '') && Number.isFinite(Date.parse(`${video.date}T12:00:00Z`));
}

export function mergeVideos(existing, incoming) {
  const byId = new Map();
  for (const video of [...existing, ...incoming]) {
    if (!validVideo(video)) continue;
    const previous = byId.get(video.id);
    byId.set(video.id, {
      id: video.id,
      title: video.title.trim(),
      date: video.date,
      durationSeconds: Number.isFinite(video.durationSeconds) && video.durationSeconds >= 0 ? video.durationSeconds : previous?.durationSeconds ?? null,
      description: typeof video.description === 'string' && video.description.trim() ? video.description : previous?.description ?? null,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      image: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    });
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

async function responseBody(url, { fetchImpl, timeoutMs, headers = {} }) {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers?.get?.('content-length') || 0);
  if (length > 6_000_000) throw new Error('Ответ слишком большой');
  const body = await response.text();
  if (body.length > 6_000_000) throw new Error('Ответ слишком большой');
  return body;
}

async function youtubeApi(method, params, config) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${method}`);
  for (const [name, value] of Object.entries({ ...params, key: config.apiKey })) if (value != null) url.searchParams.set(name, String(value));
  const body = await responseBody(url.toString(), config);
  const data = JSON.parse(body);
  if (data?.error) throw new Error('YouTube Data API вернул ошибку');
  return data;
}

function apiDuration(duration) {
  const match = typeof duration === 'string' && duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

async function apiChannel(config) {
  const data = await youtubeApi('channels', { part: 'statistics,contentDetails', id: CHANNEL_ID }, config);
  const channel = Array.isArray(data.items) && data.items.length === 1 ? data.items[0] : null;
  if (!channel || channel.id !== CHANNEL_ID) throw new Error('YouTube Data API вернул другой канал');
  return channel;
}

async function apiVideos(channel, config) {
  if (channel.contentDetails?.relatedPlaylists?.uploads !== UPLOADS_ID) throw new Error('Не подтверждён плейлист канала');
  let pageToken;
  const seenTokens = new Set();
  const ids = [];
  const seenIds = new Set();
  do {
    if (seenTokens.size >= 100 || (pageToken && seenTokens.has(pageToken))) throw new Error('Ошибка страниц плейлиста');
    if (pageToken) seenTokens.add(pageToken);
    const data = await youtubeApi('playlistItems', { part: 'snippet,contentDetails', playlistId: UPLOADS_ID, maxResults: 50, pageToken }, config);
    if (!Array.isArray(data.items)) throw new Error('Неполный ответ плейлиста');
    for (const item of data.items) {
      const id = item.contentDetails?.videoId;
      const owner = item.snippet?.videoOwnerChannelId;
      if (!YOUTUBE_ID.test(id || '') || (owner && owner !== CHANNEL_ID) || seenIds.has(id)) throw new Error('Некорректный выпуск в плейлисте');
      ids.push(id);
      seenIds.add(id);
    }
    pageToken = data.nextPageToken;
    if (pageToken != null && (typeof pageToken !== 'string' || !pageToken)) throw new Error('Некорректная следующая страница');
  } while (pageToken);
  if (!ids.length) throw new Error('Плейлист канала пуст');
  const videos = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const data = await youtubeApi('videos', { part: 'snippet,contentDetails', id: batch.join(','), maxResults: 50 }, config);
    if (!Array.isArray(data.items) || data.items.length !== batch.length) throw new Error('Неполные данные выпусков');
    const returned = new Set();
    for (const item of data.items) {
      if (!batch.includes(item.id) || returned.has(item.id) || item.snippet?.channelId !== CHANNEL_ID) throw new Error('Неверные данные выпуска');
      returned.add(item.id);
      const video = {
        id: item.id,
        title: item.snippet.title,
        date: typeof item.snippet.publishedAt === 'string' ? item.snippet.publishedAt.slice(0, 10) : '',
        description: typeof item.snippet.description === 'string' ? item.snippet.description : null,
        durationSeconds: apiDuration(item.contentDetails?.duration),
      };
      if (!validVideo(video)) throw new Error('Неверные данные выпуска');
      videos.push(video);
    }
  }
  return videos;
}

async function atomicWrite(targetFile, content) {
  const temporary = path.join(path.dirname(targetFile), `.${path.basename(targetFile)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporary, targetFile);
  } finally { await unlink(temporary).catch(() => {}); }
}

export async function syncChannel(options = {}) {
  const targetFile = path.resolve(options.targetFile || DEFAULT_TARGET);
  const catalogFile = path.resolve(options.catalogFile || DEFAULT_CATALOG);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 12_000;
  const apiKey = options.apiKey === undefined ? process.env.YOUTUBE_API_KEY : options.apiKey;
  const nowValue = typeof options.now === 'function' ? options.now() : options.now;
  const now = nowValue == null ? new Date() : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) throw new Error('Неверная дата синхронизации');
  const checkedAt = now.toISOString();
  const result = { ok: false, videoSource: null, videoCount: 0, subscribersUpdated: false, mileageUpdated: false, errors: [], targetFile };
  await mkdir(path.dirname(targetFile), { recursive: true });
  const lockPath = `${targetFile}.lock`;
  const lockToken = randomUUID();
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') return { ...result, skipped: true, errors: ['Синхронизация уже выполняется'] };
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ token: lockToken, pid: process.pid, startedAt: checkedAt }));
    const state = await readState(targetFile);
    const config = { fetchImpl, timeoutMs, apiKey };
    let channel = null;
    let freshVideos = null;
    let didWork = false;

    if (apiKey) {
      try {
        channel = await apiChannel(config);
        const statistics = channel.statistics;
        if (statistics?.hiddenSubscriberCount === true) {
          state.subscribers = null;
          state.subscriberCountHidden = true;
          result.subscribersUpdated = true;
          didWork = true;
        } else if (/^\d+$/u.test(statistics?.subscriberCount || '')) {
          const count = Number(statistics.subscriberCount);
          if (Number.isSafeInteger(count)) {
            state.subscribers = { count, observedAt: checkedAt, source: 'youtube-data-api' };
            state.subscriberCountHidden = false;
            result.subscribersUpdated = true;
            didWork = true;
          }
        }
        freshVideos = await apiVideos(channel, config);
        result.videoSource = 'youtube-data-api';
      } catch { result.errors.push('YouTube Data API недоступен или вернул неполные данные'); }
    }
    if (!freshVideos) {
      try {
        freshVideos = parseFeed(await responseBody(FEED_URL, config));
        result.videoSource = 'youtube-rss';
      } catch { result.errors.push('Лента YouTube недоступна или не прошла проверку'); }
    }
    if (!result.subscribersUpdated) {
      try {
        const page = await responseBody(CHANNEL_URL, { ...config, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
        const count = parseSubscriberPage(page);
        if (count == null) throw new Error('Счётчик не найден');
        state.subscribers = { count, observedAt: checkedAt, source: 'youtube-channel-page' };
        state.subscriberCountHidden = false;
        result.subscribersUpdated = true;
        didWork = true;
      } catch { result.errors.push('Счётчик подписчиков недоступен'); }
    }

    if (freshVideos) {
      state.videos = mergeVideos(state.videos, freshVideos);
      state.videoCheckedAt = checkedAt;
      result.videoCount = freshVideos.length;
      didWork = true;

      const known = await baselineIds(catalogFile);
      const videoMap = new Map(state.videos.map((video) => [video.id, video]));
      const scan = state.videos.filter((video) => !known.has(video.id) && video.date > (state.mileage?.asOf || '2026-09-27')).map((video) => {
        const hash = createHash('sha256').update(`${video.title}\n${video.description || ''}`).digest('hex');
        const previous = state.mileageChecks[video.id];
        const lastCheck = previous?.checkedAt ? Date.parse(previous.checkedAt) : 0;
        return { video, hash, previous, lastCheck };
      }).filter(({ hash, previous, lastCheck }) => !previous || previous.hash !== hash || !Number.isFinite(lastCheck) || now.getTime() - lastCheck >= 24 * 60 * 60 * 1000)
        .sort((a, b) => (a.previous ? 1 : 0) - (b.previous ? 1 : 0) || a.lastCheck - b.lastCheck || b.video.date.localeCompare(a.video.date))
        .slice(0, options.maxMileageChecks ?? 3);

      for (const item of scan) {
        try {
          const candidate = await (options.extractMileageCandidate || extractMileageCandidate)(item.video, { fetchImpl, timeoutMs, now });
          state.mileageChecks[item.video.id] = { checkedAt, hash: item.hash };
          const previous = state.mileage;
          if (candidate && candidate.videoId === item.video.id && candidate.asOf === item.video.date && candidate.asOf <= checkedAt.slice(0, 10) && Number.isSafeInteger(candidate.miles) && candidate.miles >= (previous?.miles || 0) && candidate.asOf > (previous?.asOf || '') && videoMap.has(candidate.videoId)) {
            state.mileage = { miles: candidate.miles, asOf: candidate.asOf, videoId: candidate.videoId, timeSeconds: Number.isInteger(candidate.timeSeconds) && candidate.timeSeconds >= 0 ? candidate.timeSeconds : null, source: typeof candidate.source === 'string' ? candidate.source : 'description', ...(typeof candidate.evidence === 'string' ? { evidence: candidate.evidence.slice(0, 300) } : {}) };
            result.mileageUpdated = true;
          }
        } catch { result.errors.push('Пробег в одном из выпусков не удалось проверить'); }
      }
    }
    if (didWork) {
      state.lastCheckedAt = checkedAt;
      await atomicWrite(targetFile, `${JSON.stringify(state, null, 2)}\n`);
      result.ok = true;
    }
    return result;
  } finally {
    await lock.close().catch(() => {});
    try {
      const saved = JSON.parse(await readFile(lockPath, 'utf8'));
      if (saved.token === lockToken) await unlink(lockPath);
    } catch { /* Never remove a lock that could belong to another process. */ }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncChannel();
    console.log(JSON.stringify({ ...result, targetFile: undefined }, null, 2));
    if (!result.ok && !result.skipped) process.exitCode = 1;
  } catch {
    console.error('Не удалось сохранить данные канала; прежний файл не изменён.');
    process.exitCode = 1;
  }
}
