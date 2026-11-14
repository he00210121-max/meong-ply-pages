import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { MockUsage } from './mock_gemini_usage.ts';

process.env.NODE_ENV = 'test';
const { app, configureRecommendationTest, configureUsageStoreTest } = await import('../server.ts');
configureUsageStoreTest(new MockUsage());
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test address');
const url = `http://127.0.0.1:${address.port}/api/recommend`;
const songs = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ title: `Song ${i + start}`, artist: `Artist ${i + start}`, year: '2020', reason: '좋은 음악' }));
const content = (start: number, count: number) => JSON.stringify({ title: 'Test', songs: songs(start, count) });
const request = async (body: Record<string, unknown> = {}) => {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '테스트 음악', model: 'groq', count: 5, ...body }) });
  return { status: res.status, data: await res.json() };
};
try {
  let calls = 0;
  configureRecommendationTest(async () => { calls++; await delay(10); return { content: content(0, 5) }; }, 1000);
  let started = performance.now();
  const fast = await request();
  assert.equal(fast.status, 200); assert.equal(fast.data.songs.length, 5); assert.equal(calls, 1);
  console.log(`빠른 응답: ${Math.round(performance.now() - started)}ms, AI ${calls}회`);
  started = performance.now();
  const cached = await request();
  assert.equal(cached.data.source, 'cache'); assert.equal(calls, 1);
  console.log(`캐시 적중: ${Math.round(performance.now() - started)}ms, 추가 AI 0회`);
  const history = await request({ excludeHistory: [{ title: 'Song 0', artist: 'Artist 0' }] });
  assert.equal(calls, 3); assert(!history.data.songs.some((s: any) => s.title === 'Song 0' && s.artist === 'Artist 0'));
  console.log('최근 기록: 캐시 우회 및 해당 곡 제외');

  calls = 0;
  configureRecommendationTest(async () => { calls++; await delay(180); return { content: content(0, 5) }; }, 1000);
  started = performance.now();
  const slow = await request(); assert.equal(slow.status, 200); assert.equal(slow.data.songs.length, 5);
  console.log(`느린 응답: ${Math.round(performance.now() - started)}ms, 정상 완료`);

  calls = 0;
  configureRecommendationTest(async ({ phase }) => { calls++; return { content: phase === 'initial' ? content(0, 3) : content(3, 2) }; }, 1000);
  const shortage = await request(); assert.equal(shortage.data.songs.length, 5); assert.equal(calls, 2);
  console.log('곡 수 부족: 보충 1회, 5곡 완성');

  calls = 0;
  configureRecommendationTest(async () => { calls++; return { content: content(0, 30) }; }, 1000);
  const large = await request({ model: 'gemini', count: 30 });
  assert.equal(large.status, 200); assert.equal(large.data.songs.length, 30); assert.equal(calls, 1);
  console.log('Gemini 30곡: 정상 완료');

  configureRecommendationTest(async () => { throw new Error('simulated provider failure'); }, 1000);
  const failed = await request(); assert.equal(failed.status, 500); assert.match(failed.data.error, /문제/);
  console.log('AI 실패: 오류 응답 확인');

  let aborted = false;
  calls = 0;
  configureRecommendationTest(async ({ signal }) => {
    calls++;
    try { await delay(250, undefined, { signal }); }
    catch (error) { aborted = signal.aborted; throw error; }
    return { content: content(0, 5) };
  }, 60);
  started = performance.now();
  const timeout = await request(); assert.equal(timeout.status, 504); assert.match(timeout.data.error, /오래/);
  assert.equal(aborted, true); assert.equal(calls, 1);
  console.log(`타임아웃: ${Math.round(performance.now() - started)}ms에 504 반환 (지연 250ms)`);

  let disconnectAborted = false;
  let entered!: () => void;
  const enteredAi = new Promise<void>(resolve => { entered = resolve; });
  configureRecommendationTest(async ({ signal }) => {
    entered();
    try { await delay(1000, undefined, { signal }); }
    catch (error) { disconnectAborted = signal.aborted; throw error; }
    return { content: content(0, 5) };
  }, 2000);
  const client = new AbortController();
  const disconnected = fetch(url, { method: 'POST', signal: client.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'private-query', model: 'groq', count: 5 }) }).catch(() => undefined);
  await enteredAi; client.abort(); await disconnected;
  for (let i = 0; i < 20 && !disconnectAborted; i++) await delay(10);
  assert.equal(disconnectAborted, true);
  console.log('연결 종료: AI 취소 신호 확인');

  const originalInfo = console.info;
  const summaries: unknown[][] = [];
  console.info = (...args: unknown[]) => { summaries.push(args); };
  try {
    configureRecommendationTest(async () => ({ content: content(0, 5) }), 1000);
    await request({ query: 'private-query', vibe: 'private-preference', model: 'groq' });
  } finally { console.info = originalInfo; }
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0][0], '[recommend timing]');
  const summary = summaries[0][1] as Record<string, unknown>;
  assert.deepEqual(Object.keys(summary).sort(), ['requestId', 'model', 'requestedCount', 'initialAiMs', 'continuationMs', 'filteringMs', 'resultCount', 'totalMs'].sort());
  assert.equal(summary.model, 'groq'); assert.equal(summary.requestedCount, 5); assert.equal(summary.resultCount, 5);
  assert(!JSON.stringify(summaries).includes('private'));
  console.log('요약 로그: 허용된 필드만 1회 기록');
} finally { server.close(); }
