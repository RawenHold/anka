import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoRecords, categories, videoRecords } from '../src/data/archive.js';
import { fallbackChannelData, reconcileChannelData } from '../src/hooks/useChannelData.js';

const channelId = 'UCmLSYJkWLEbcrF4By3StTvQ';

test('home and household share a category; leisure activities have their own filter', () => {
  const ids = new Set(categories.map((category) => category.id));
  assert.equal(ids.has('life'), false);
  assert.ok(ids.has('home') && ids.has('entertainment'));
  assert.equal(categories.find((category) => category.id === 'travel').short, 'Наш отдых');
  for (const id of ['FcMOxsOTTo0', '_qi-UrZrqgE', 'XnAzEBVlVAo']) {
    assert.equal(videoRecords.find((video) => video.id === id)?.category, 'entertainment');
  }
  assert.equal(videoRecords.find((video) => video.id === '3YePZZ47k2w')?.category, 'home');
  assert.equal(videoRecords.find((video) => video.id === 'hMstmrlZtDY')?.category, 'travel');
  const fresh = buildVideoRecords([{ id: 'NEWVIDEO001', title: 'Покатались на мотоциклах', date: '2026-11-19' }]);
  assert.equal(fresh.find((video) => video.id === 'NEWVIDEO001')?.category, 'entertainment');
});

test('the archived videos have editorial categories and evidenced city links', () => {
  assert.equal(videoRecords.filter((video) => video.category === 'uncategorized').length, 0);
  assert.ok(videoRecords.find((video) => video.id === 'nwihQC-9s7Q').places.includes('Istanbul'));
  assert.ok(videoRecords.find((video) => video.id === 'hMstmrlZtDY').places.includes('Nassau'));
});

test('Las Vegas hotel New York does not mark the video as New York state', () => {
  const weekend = videoRecords.find((video) => video.id === 'iICSermp-fs');
  assert.equal(weekend.places.includes('New York'), false);
  assert.equal(weekend.places.includes('Las Vegas'), true);
  const ny = videoRecords.find((video) => video.id === 's1pIHAkTlZg');
  assert.equal(ny.placeTimes['New York'], 639);
});

test('the pool episode links to caption-backed topics, without claiming author chapters', () => {
  const pool = videoRecords.find((video) => video.id === 'LtPcCPDdO38');
  assert.equal(pool.chapters.length, 0);
  assert.equal(pool.captionTopics, true);
  assert.ok(pool.captionMoments.some((moment) => moment.time === '27:32'));
  assert.ok(videoRecords.find((video) => video.id === 'Obnw_tJCcxI').captionMoments.length > 1);
});

test('every video in the archived snapshot has source-backed navigation moments', () => {
  assert.equal(videoRecords.filter((video) => !video.chapters.length && !video.captionMoments.length).length, 0);
  assert.equal(videoRecords.find((video) => video.id === '07J4_jChHTw').frameMoments, true);
});

test('a newly hidden subscriber count is not displayed as an old number', () => {
  const next = reconcileChannelData(fallbackChannelData, { schemaVersion: 1, channelId, lastCheckedAt: '2026-11-19T12:00:00Z', subscriberCountHidden: true, subscribers: null });
  assert.equal(next.subscribers, null);
});

test('live videos merge by ID while curated archive survives and chapters work without duration', () => {
  const existing = videoRecords.find((video) => video.id === 'AgAbY3alNxI');
  const live = [
    { id: 'NEWVIDEO001', title: 'Новый рейс', date: '2026-11-18', durationSeconds: null, description: '00:10 В дороге\n02:30 Остановка' },
    { id: 'AgAbY3alNxI', title: existing.title, date: existing.date, durationSeconds: null, description: null },
    { id: 'NEWVIDEO001', title: 'Новый рейс', date: '2026-11-18', durationSeconds: null, description: '00:10 В дороге\n02:30 Остановка' },
  ];
  const result = buildVideoRecords(live);
  assert.equal(result.length, videoRecords.length + 1);
  assert.equal(result[0].id, 'NEWVIDEO001');
  assert.deepEqual(result[0].chapters.map((chapter) => chapter.time), ['00:10', '02:30']);
  assert.equal(result[0].duration, '');
  const preserved = result.find((video) => video.id === existing.id);
  assert.equal(preserved.description, existing.description);
  assert.deepEqual(preserved.places, existing.places);
  assert.equal(preserved.category, existing.category);
  assert.equal(preserved.duration, existing.duration);
});

test('wrong channel, stale or malformed data cannot overwrite last verified values', () => {
  assert.equal(reconcileChannelData(fallbackChannelData, { schemaVersion: 1, channelId: 'other' }), fallbackChannelData);
  const result = reconcileChannelData(fallbackChannelData, {
    schemaVersion: 1, channelId, videoCheckedAt: '2026-11-18T12:00:00Z',
    videos: [{ id: 'NEWVIDEO001', title: 'Выпуск', date: '2026-11-18' }, { id: 12345678901, title: 'Неверный ID' }],
    subscribers: { count: 999999, observedAt: '2026-10-01T00:00:00Z' },
    mileage: { miles: 900000, asOf: '2026-11-31', videoId: 'NEWVIDEO001' },
  });
  assert.equal(result.videos.length, 1);
  assert.equal(result.subscribers.count, 193000);
  assert.equal(result.mileage.miles, 800000);
});

test('newer data update counters and preserve earlier live videos after a partial refresh', () => {
  const first = reconcileChannelData(fallbackChannelData, {
    schemaVersion: 1, channelId, videoCheckedAt: '2026-11-18T12:00:00Z',
    videos: [{ id: 'NEWVIDEO001', title: 'Выпуск', date: '2026-11-18', description: 'Глава' }],
    subscribers: { count: 194000, observedAt: '2026-11-18T12:00:00Z' },
    mileage: { miles: 820000, asOf: '2026-11-18', videoId: 'NEWVIDEO001', timeSeconds: 120 },
  });
  const second = reconcileChannelData(first, { schemaVersion: 1, channelId, videoCheckedAt: '2026-11-19T12:00:00Z', videos: [] });
  assert.equal(second.videos.length, 1);
  assert.equal(second.subscribers.count, 194000);
  assert.equal(second.mileage.miles, 820000);
});
