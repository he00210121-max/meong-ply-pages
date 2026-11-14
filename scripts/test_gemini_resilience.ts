import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { MockUsage } from './mock_gemini_usage.ts';
process.env.NODE_ENV = 'test';
const { app, configureRecommendationTest, configureUsageStoreTest } = await import('../server.ts');
configureUsageStoreTest(new MockUsage());
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const addr = server.address();
if (!addr || typeof addr === 'string') throw Error('No address');
const url = `http://127.0.0.1:${addr.port}/api/recommend`;
const content = (n: number) => JSON.stringify({ title: 'Test', songs: Array.from({ length: n }, (_, i) => ({ title: `Song ${i}`, artist: `Artist ${i}`, year: '2020', reason: '좋은 음악' })) });
const request = async (count = 5, signal?: AbortSignal) => {
  const res = await fetch(url, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '비공개 검색', vibe: '비공개 취향', model: 'gemini', count, forceRefresh: true }) });
  return { status: res.status, data: await res.json() };
};
try {
  for (const count of [5, 30]) {
    let calls = 0;
    configureRecommendationTest(async () => { calls++; await delay(10); return { content: content(count) }; }, 1000, 100);
    const result = await request(count);
    assert.equal(result.status, 200); assert.equal(result.data.songs.length, count); assert.equal(calls, 1);
  }
  let calls = 0;
  configureRecommendationTest(async () => { calls++; await delay(30); return { content: content(5) }; }, 1000, 100);
  assert.equal((await request()).status, 200); assert.equal(calls, 1);
  let aborted = false; calls = 0;
  configureRecommendationTest(async ({ signal }) => { calls++; signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }, 1000, 50);
  const start = performance.now(); const timeout = await request();
  assert.equal(timeout.status, 504); assert(performance.now() - start < 500); assert.equal(calls, 1); assert(aborted);
  for (const code of [401, 403, 429, 503, 504]) {
    calls = 0; configureRecommendationTest(async () => { calls++; throw { status: code, message: '비공개 오류' }; }, 1000, 100);
    const result = await request(); assert.equal(result.status, code); assert.equal(calls, 1);
    assert.match(result.data.error, code === 429 ? /한도/ : code < 429 ? /인증/ : /지연/);
  }
  calls = 0; configureRecommendationTest(async () => { calls++; throw { status: 404 }; }, 1000, 100);
  const missing = await request(); assert.equal(missing.status, 500); assert.equal(calls, 1);
  let entered!: () => void; const enteredPromise = new Promise<void>(r => { entered = r; }); aborted = false;
  configureRecommendationTest(async ({ signal }) => { entered(); signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }, 1000, 500);
  const controller = new AbortController(); const pending = request(5, controller.signal).catch(() => undefined);
  await enteredPromise; controller.abort(); await pending;
  for (let i = 0; i < 30 && !aborted; i++) await delay(10);
  assert(aborted);
  configureRecommendationTest(async () => ({ content: content(5) }), 1000, 100);
  assert.equal((await request()).status, 200);
  console.log('Gemini mocks: 5/30, delay, no response, 401/403/429/503/504, 404, cancellation, retry passed');
} finally { server.close(); }
