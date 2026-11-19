import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLiveMusic } from '../src/data/live-music.js';
import { buildVideoRecords } from '../src/data/archive.js';
import { getVideoMusic } from '../src/data/music-by-video.js';

test('extracts direct music links from a new video without trusting unrelated links', () => {
  const video = { id: 'NEWVIDEO001', title: 'Новый выпуск', sourceDescription: '01:15 В дороге\n🎵 https://suno.com/s/abc123\n03:20 🎵 https://youtu.be/abcdefghijk\nНаше видео https://youtu.be/zyxwvutsrqp\nhttps://suno.com.evil.example/s/fake' };
  const tracks = extractLiveMusic(video);
  assert.deepEqual(tracks.map((item) => item.platform), ['Suno', 'YouTube']);
  assert.equal(tracks[0].mentions[0].time, '01:15');
  assert.equal(tracks[0].mentions[0].timeIsApproximate, true);
  assert.equal(tracks[1].mentions[0].time, '03:20');
});

test('does not duplicate the reviewed music for a bundled archive video', () => {
  assert.deepEqual(extractLiveMusic({ id: 'hMstmrlZtDY', sourceDescription: '🎵 https://suno.com/s/abc123' }), []);
});

test('a newly synchronized video exposes its music in the video dialog', () => {
  const videos = buildVideoRecords([{ id: 'NEWVIDEO001', title: 'Новый рейс', date: '2026-11-19', description: '02:15 🎵 https://suno.com/s/newSong' }]);
  const video = videos.find((item) => item.id === 'NEWVIDEO001');
  const { tracks } = getVideoMusic(video.id, video);
  assert.equal(tracks[0].track.listenUrl, 'https://suno.com/s/newSong');
  assert.equal(tracks[0].mention.time, '02:15');
});
