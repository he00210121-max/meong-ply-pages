import assert from 'node:assert/strict';
import { MockUsage } from './mock_gemini_usage.ts';
import { BACKUP_MODEL, PRIMARY_MODEL, UsageUnavailable, isDailyRequestQuota } from '../src/server/geminiUsage.ts';

process.env.NODE_ENV = 'test';
const { app, configureRecommendationTest, configureUsageStoreTest } = await import('../server.ts');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const addr = server.address();
if (!addr || typeof addr === 'string') throw new Error('no address');
const url = `http://127.0.0.1:${addr.port}/api/recommend`;
const content = JSON.stringify({ songs: Array.from({ length: 5 }, (_, i) => ({ title: `Song ${i}`, artist: `Artist ${i}` })) });
async function request(extra: object = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test music', count: 5, model: 'gemini', forceRefresh: true, ...extra }) });
  return { status: res.status, data: await res.json() };
}
try {
  process.env.GEMINI_ADMIN_PASSWORD = 'test-admin-secret-at-least-24-characters';
  const adminUrl = `http://127.0.0.1:${addr.port}/admin/gemini`;
  assert.equal((await fetch(`${adminUrl}/status`)).status, 401);
  const auth = `Basic ${Buffer.from(`admin:${process.env.GEMINI_ADMIN_PASSWORD}`).toString('base64')}`;
  assert.equal((await fetch(`${adminUrl}/reset`, { method: 'POST', headers: { authorization: auth } })).status, 403);
  const db = new MockUsage(); db.primaryToday = 499; configureUsageStoreTest(db);
  assert.equal((await fetch(`${adminUrl}/status`, { headers: { authorization: auth } })).status, 200);
  configureRecommendationTest(async () => ({ content }), 1000, 200);
  const fiveHundred = await request();
  assert.equal(fiveHundred.status, 200); assert.match(fiveHundred.data.modelUsed, /3.5-flash-lite/); assert.equal(db.primaryToday, 500);
  const next = await request(); assert.equal(next.status, 200); assert.match(next.data.modelUsed, /3.1-flash-lite/);
  // A fresh application configuration retaining the shared durable store must not switch back.
  configureUsageStoreTest(db); configureRecommendationTest(async () => ({ content }), 1000, 200);
  assert.match((await request()).data.modelUsed, /3.1-flash-lite/);
  const concurrent = new MockUsage(); concurrent.primaryToday = 499;
  const models = await Promise.all(Array.from({ length: 20 }, (_, i) => concurrent.reserve(String(i), 'initial')));
  assert.equal(models.filter(m => m === PRIMARY_MODEL).length, 1); assert.equal(models.filter(m => m === BACKUP_MODEL).length, 19);
  assert(isDailyRequestQuota({ status: 429, message: 'GenerateRequestsPerDayPerProjectPerModel' }));
  assert(!isDailyRequestQuota({ status: 429, message: 'GenerateRequestsPerMinutePerProjectPerModel' }));
  const daily = new MockUsage(); configureUsageStoreTest(daily); let attempts = 0;
  configureRecommendationTest(async () => { if (++attempts === 1) throw { status: 429, message: 'GenerateRequestsPerDayPerProjectPerModel' }; return { content }; }, 1000, 200);
  assert.match((await request()).data.modelUsed, /3.1-flash-lite/); assert.equal(attempts, 2);
  assert.deepEqual([...daily.calls.values()].map(c => c.phase), ['initial', 'retry']);
  const minute = new MockUsage(); configureUsageStoreTest(minute); attempts = 0;
  configureRecommendationTest(async () => { attempts++; throw { status: 429, message: 'GenerateRequestsPerMinutePerProjectPerModel' }; }, 1000, 200);
  assert.equal((await request()).status, 429); assert.equal(attempts, 1); assert.equal(minute.model, PRIMARY_MODEL);
  const broken = new MockUsage(); broken.reserve = async () => { throw new UsageUnavailable(); }; configureUsageStoreTest(broken); attempts = 0;
  configureRecommendationTest(async () => { attempts++; return { content }; }, 1000, 200);
  assert.equal((await request()).status, 503); assert.equal(attempts, 0);
  const cache = new MockUsage(); configureUsageStoreTest(cache); attempts = 0;
  configureRecommendationTest(async () => { attempts++; return { content }; }, 1000, 200);
  await request({ forceRefresh: false }); await request({ forceRefresh: false }); assert.equal(attempts, 1);
  const cont = new MockUsage(); configureUsageStoreTest(cont); attempts = 0;
  configureRecommendationTest(async () => { attempts++; return { content: JSON.stringify({ songs: [{ title: 'Song', artist: `Artist ${attempts}` }] }) }; }, 1000, 200);
  await request(); assert.deepEqual([...cont.calls.values()].map(c => c.phase), ['initial', 'continuation']);
  console.log('Usage mocks passed: 499/500/501, concurrency simulation, restart simulation, daily/minute 429, DB failure, cache, continuation');
} finally { server.close(); }
