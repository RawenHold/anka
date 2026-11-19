import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMileageCandidate } from '../scripts/lib/mileage.mjs';
import { getRussianCaptions, parseCaptionText, parsePlayerResponse } from '../scripts/lib/transcripts.mjs';

const id = 'AgAbY3alNxI';
const video = (description, overrides = {}) => ({ id, date: '2026-11-18', title: 'Мы в рейсе на нашем Volvo VNL 860', description, ...overrides });
const noCaptions = { includeCaptions: false };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });
const playerPage = (videoId = id, trackUrl = `https://www.youtube.com/api/timedtext?v=${id}&lang=ru`) => `<script>var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { videoId }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'ru', kind: 'asr', baseUrl: trackUrl }] } } })};</script>`;
const jsonCaptions = (...entries) => JSON.stringify({ events: entries.map(([time, text]) => ({ tStartMs: time * 1000, segs: [{ utf8: text }] })) });

test('extracts a dated odometer reading and its timestamp from a chapter', async () => {
  const hit = await extractMileageCandidate(video('10:15 Пробег нашего Volvo VNL 860 — 850.123 миль'), noCaptions);
  assert.deepEqual(hit, { miles: 850123, asOf: '2026-11-18', videoId: id, timeSeconds: 615, source: 'description', evidence: '10:15 Пробег нашего Volvo VNL 860 — 850.123 миль' });
});

test('keeps the odometer separate from a trip and from rear tyres', async () => {
  const text = '01:18 Пробег нашего трака Volvo VNL 860 855.555 миль\n05:14 Едем 750 миль\n08:37 Задние колёса прошли 200.000 миль';
  assert.equal((await extractMileageCandidate(video(text), noCaptions))?.miles, 855555);
});

test('understands exact Russian numbers written as words', async () => {
  const hit = await extractMileageCandidate(video('Пробег нашего Volvo — восемьсот пятьдесят тысяч миль.'), noCaptions);
  assert.equal(hit?.miles, 850000);
  const million = await extractMileageCandidate(video('Пробег нашего Volvo — один миллион двести тридцать тысяч миль.'), noCaptions);
  assert.equal(million?.miles, 1230000);
});

test('understands exact numeric thousands and hours in a timestamp', async () => {
  const hit = await extractMileageCandidate(video('1:01:51 Пробег нашего Volvo — 850 тысяч миль'), noCaptions);
  assert.equal(hit?.miles, 850000);
  assert.equal(hit?.timeSeconds, 3711);
});

test('rejects old videos, unchanged or smaller values, and invalid dates', async () => {
  assert.equal(await extractMileageCandidate(video('Пробег нашего Volvo 900 000 миль', { date: '2026-09-27' }), noCaptions), null);
  assert.equal(await extractMileageCandidate(video('Пробег нашего Volvo 800 000 миль'), noCaptions), null);
  assert.equal(await extractMileageCandidate(video('Пробег нашего Volvo 799 999 миль'), noCaptions), null);
  assert.equal(await extractMileageCandidate(video('Пробег нашего Volvo 900 000 миль', { date: '2026-02-31' }), noCaptions), null);
});

test('rejects uncertain, foreign, old, future and non-odometer figures', async () => {
  for (const text of [
    'Пробег нашего Volvo примерно 900 000 миль',
    'Пробег нашего Volvo не 900 000 миль',
    'Пробег нашего Volvo от 850 до 900 тысяч миль',
    'Раньше пробег нашего Volvo был 900 000 миль',
    'Пробег нашего Volvo достигнет 900 000 миль скоро',
    'Пробег нашего Volvo 99 850 000 миль',
    'Пробег нашего старого Volvo 900 000 миль',
    'Пробег проданного нашего Volvo 900 000 миль',
    'Я нашел Volvo, пробег 900 000 миль',
    'Пробег чужого Volvo 900 000 миль',
    'Наш Volvo скоро будет иметь пробег 900 000 миль',
    'Пробег нашего Volvo 900 000 километров',
    'Колёса нашего Volvo прошли 900 000 миль',
    'Пробег нашего трака Peterbilt 900 000 миль',
    'Пробег нашего Volvo 900 000 миль, на колёсах 200 000 миль',
  ]) assert.equal(await extractMileageCandidate(video(text, { title: 'Новости из рейса' }), noCaptions), null, text);
});

test('rejects contradictory exact readings in a single episode', async () => {
  const text = '01:00 Пробег нашего Volvo 850 000 миль\n02:00 Пробег нашего Volvo 900 000 миль';
  assert.equal(await extractMileageCandidate(video(text), noCaptions), null);
});

test('combines neighboring caption cues while preserving a time and source', async () => {
  const transcript = jsonCaptions([123, 'пробег нашего'], [126, 'синего Volvo VNL 860'], [130, 'восемьсот пятьдесят тысяч миль']);
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return response(seen.length === 1 ? playerPage() : transcript); };
  const hit = await extractMileageCandidate(video('Всем привет!'), { fetchImpl });
  assert.equal(hit?.miles, 850000);
  assert.equal(hit?.source, 'captions');
  assert.equal(hit?.timeSeconds, 123);
  assert.match(hit?.evidence, /восемьсот пятьдесят тысяч миль/u);
  assert.equal(seen.length, 2);
});

test('does not join unrelated subtitle phrases across a long gap', async () => {
  const transcript = jsonCaptions([12, 'пробег нашего Volvo'], [32, 'восемьсот пятьдесят тысяч миль']);
  let count = 0;
  const fetchImpl = async () => response(++count === 1 ? playerPage() : transcript);
  assert.equal(await extractMileageCandidate(video(''), { fetchImpl }), null);
});

test('does not accept a caption before its immediate qualification', async () => {
  const transcript = jsonCaptions([12, 'пробег нашего Volvo'], [14, 'девятьсот тысяч миль'], [16, 'но это было раньше']);
  let count = 0;
  const fetchImpl = async () => response(++count === 1 ? playerPage() : transcript);
  assert.equal(await extractMileageCandidate(video(''), { fetchImpl }), null);
});

test('parses only the requested video player JSON without evaluating scripts', () => {
  const hostilePage = `<script>var unrelated = 'not a player'; var ytInitialPlayerResponse = {"videoDetails":{"videoId":"BBBBBBBBBBB"}};</script>${playerPage()}`;
  assert.equal(parsePlayerResponse(hostilePage, id)?.videoDetails.videoId, id);
  assert.equal(parsePlayerResponse(playerPage('BBBBBBBBBBB'), id), null);
});

test('rejects subtitle URLs from other hosts and video identifiers', async () => {
  for (const url of ['https://example.com/api/timedtext?v=AgAbY3alNxI', 'https://www.youtube.com/api/timedtext?v=BBBBBBBBBBB', 'http://www.youtube.com/api/timedtext?v=AgAbY3alNxI']) {
    const calls = [];
    const fetchImpl = async (input) => { calls.push(String(input)); return response(playerPage(id, url)); };
    assert.deepEqual(await getRussianCaptions(id, { fetchImpl }), []);
    assert.equal(calls.length, 1);
  }
});

test('treats unavailable, blank and invalid caption responses as no captions', async () => {
  assert.deepEqual(await getRussianCaptions(id, { fetchImpl: async () => { throw new Error('offline'); } }), []);
  let calls = 0;
  assert.deepEqual(await getRussianCaptions(id, { fetchImpl: async () => response(++calls === 1 ? playerPage() : '') }), []);
  assert.deepEqual(parseCaptionText('{bad-json'), []);
});

test('supports classic timed-text XML as well as JSON3', () => {
  assert.deepEqual(parseCaptionText('<transcript><text start="10.4" dur="2">наш Volvo &amp; пробег</text></transcript>'), [{ timeSeconds: 10, text: 'наш Volvo & пробег' }]);
});
