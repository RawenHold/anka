import { useEffect, useState } from 'react';

const CHANNEL_ID = 'UCmLSYJkWLEbcrF4By3StTvQ';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const REFRESH_INTERVAL = 5 * 60 * 1000;

export const fallbackChannelData = {
  schemaVersion: 1,
  channelId: CHANNEL_ID,
  lastCheckedAt: null,
  videoCheckedAt: '2026-11-17T08:37:39.845Z',
  videos: [],
  subscribers: { count: 193000, observedAt: '2026-11-17T00:00:00.000Z', source: 'snapshot' },
  mileage: { miles: 800000, asOf: '2026-09-27', videoId: 'AgAbY3alNxI', timeSeconds: 581, source: 'video' },
};

const validTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanVideo(value) {
  if (!value || typeof value.id !== 'string' || !VIDEO_ID.test(value.id) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 1000) return null;
  return {
    id: value.id,
    title: value.title.trim(),
    date: validDate(value.date) ? value.date : null,
    durationSeconds: Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0 ? value.durationSeconds : null,
    description: typeof value.description === 'string' ? value.description.slice(0, 100000) : null,
  };
}

/** Keep the last valid snapshot when a feed is partial, stale, or unavailable. */
export function reconcileChannelData(previous, incoming) {
  if (!incoming || incoming.schemaVersion !== 1 || incoming.channelId !== CHANNEL_ID) return previous;
  const next = { ...previous };
  if (validTimestamp(incoming.lastCheckedAt) && (!validTimestamp(previous.lastCheckedAt) || Date.parse(incoming.lastCheckedAt) >= Date.parse(previous.lastCheckedAt))) next.lastCheckedAt = incoming.lastCheckedAt;
  if (Array.isArray(incoming.videos) && validTimestamp(incoming.videoCheckedAt) && (!validTimestamp(previous.videoCheckedAt) || Date.parse(incoming.videoCheckedAt) >= Date.parse(previous.videoCheckedAt))) {
    const byId = new Map(previous.videos.map((video) => [video.id, video]));
    for (const item of incoming.videos) {
      const video = cleanVideo(item);
      if (video) {
        const old = byId.get(video.id);
        byId.set(video.id, old ? {
          ...old, ...video,
          date: video.date || old.date,
          durationSeconds: video.durationSeconds ?? old.durationSeconds,
          description: video.description?.trim() ? video.description : old.description,
        } : video);
      }
    }
    next.videos = [...byId.values()];
    next.videoCheckedAt = incoming.videoCheckedAt;
  }
  const subscribers = incoming.subscribers;
  if (incoming.subscriberCountHidden === true && validTimestamp(incoming.lastCheckedAt) && (!validTimestamp(previous.lastCheckedAt) || Date.parse(incoming.lastCheckedAt) >= Date.parse(previous.lastCheckedAt))) {
    next.subscribers = null;
  } else if (subscribers && Number.isSafeInteger(subscribers.count) && subscribers.count >= 0 && subscribers.count <= 10000000000 && validTimestamp(subscribers.observedAt)
    && (!previous.subscribers || Date.parse(subscribers.observedAt) >= Date.parse(previous.subscribers.observedAt))) {
    next.subscribers = { count: subscribers.count, observedAt: subscribers.observedAt, source: String(subscribers.source || 'youtube').slice(0, 80) };
  }
  const mileage = incoming.mileage;
  if (mileage && Number.isSafeInteger(mileage.miles) && mileage.miles > 0 && mileage.miles <= 100000000 && validDate(mileage.asOf)
    && typeof mileage.videoId === 'string' && VIDEO_ID.test(mileage.videoId) && (!previous.mileage || mileage.asOf >= previous.mileage.asOf)) {
    next.mileage = {
      miles: mileage.miles, asOf: mileage.asOf, videoId: mileage.videoId,
      timeSeconds: Number.isFinite(mileage.timeSeconds) && mileage.timeSeconds >= 0 ? mileage.timeSeconds : null,
      source: String(mileage.source || 'video').slice(0, 80),
    };
  }
  return next;
}

export function useChannelData() {
  const [data, setData] = useState(fallbackChannelData);

  useEffect(() => {
    let stopped = false;
    let activeRequest = null;
    const refresh = async () => {
      if (stopped || activeRequest) return;
      const controller = new AbortController();
      activeRequest = controller;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/channel-live.json`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const incoming = await response.json();
        if (!stopped) setData((previous) => reconcileChannelData(previous, incoming));
      } catch { /* Keep the latest working snapshot while offline. */ }
      finally { if (activeRequest === controller) activeRequest = null; }
    };
    const onVisibility = () => { if (!document.hidden) refresh(); };
    refresh();
    const earlyRetry = window.setTimeout(refresh, 12000);
    const interval = window.setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(earlyRetry);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      activeRequest?.abort();
    };
  }, []);

  return data;
}
