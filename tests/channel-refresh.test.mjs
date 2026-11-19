import test from 'node:test';
import assert from 'node:assert/strict';
import { liveChannelMiddleware, startChannelRefresh } from '../scripts/channel-refresh.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('refresh starts automatically, does not overlap, and stops', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const stop = startChannelRefresh({ intervalMs: 10, sync: async () => { calls += 1; await pending; return { ok: true }; }, onError: () => assert.fail('unexpected error') });
  await delay(55);
  assert.equal(calls, 1, 'a slow update must not overlap with another');
  release();
  await delay(35);
  assert.ok(calls >= 2, 'refresh should run again on its interval');
  stop();
  await delay(20);
  const afterStop = calls;
  await delay(30);
  assert.equal(calls, afterStop);
});

test('live snapshot endpoint is uncached and rejects writes', async () => {
  const body = Buffer.from('{"schemaVersion":1}');
  const route = liveChannelMiddleware('C:/anka', async () => body);
  const response = () => ({ code: 0, headers: {}, body: undefined, writeHead(code, headers) { this.code = code; this.headers = headers; }, end(value) { this.body = value; } });
  const get = response();
  await route({ url: '/data/channel-live.json?refresh=1', method: 'GET' }, get, () => assert.fail('snapshot should be handled'));
  assert.equal(get.code, 200);
  assert.equal(get.headers['Cache-Control'], 'no-store');
  assert.deepEqual(get.body, body);
  const post = response();
  await route({ url: '/data/channel-live.json', method: 'POST' }, post, () => assert.fail('write must be rejected'));
  assert.equal(post.code, 405);
  const other = response();
  let continued = false;
  await route({ url: '/other', method: 'GET' }, other, () => { continued = true; });
  assert.equal(continued, true);
});
