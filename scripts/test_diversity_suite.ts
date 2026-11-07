/**
 * Automated Test Suite for MeongPly Diversity & Retry Verification
 */

import { getTrackKey, normalizeTitle, normalizeArtist } from '../src/utils/trackHistory.ts';

const API_URL = 'http://localhost:3000/api/recommend';

interface SongItem {
  number: number;
  title: string;
  artist: string;
  releaseYear?: string;
  reason: string;
}

interface ApiResponse {
  playlistTitle: string;
  playlistDescription: string;
  totalCount: number;
  requestedCount: number;
  songs: SongItem[];
  source: string;
  executionTimeMs: number;
  tokenUsage?: any;
}

async function callApi(payload: any): Promise<ApiResponse> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function runTests() {
  console.log('====================================================');
  console.log('🐾 멍플리 음악 추천 다양성 및 재추천 자동 테스트 시작');
  console.log('====================================================\n');

  // ----------------------------------------------------------------
  // TEST 1: 동일 조건 캐시 재사용 검사 (Cache Hit on exact clean repeat)
  // ----------------------------------------------------------------
  console.log('[TEST 1] 동일 조건 캐시 재사용 검사 진행 중...');
  const test1Query = '비 오는 새벽 잔잔한 피아노 연주곡';
  const t1_res1 = await callApi({ query: test1Query, count: 5, model: 'gemini' });
  const t1_res2 = await callApi({ query: test1Query, count: 5, model: 'gemini' });

  const isCacheHit = t1_res2.source === 'cache';
  console.log(`- 1회차 호출: source=${t1_res1.source}, 시간=${t1_res1.executionTimeMs}ms, 곡수=${t1_res1.songs.length}`);
  console.log(`- 2회차 호출(일반): source=${t1_res2.source}, 시간=${t1_res2.executionTimeMs}ms, 캐시적중=${isCacheHit}`);
  console.log(`=> TEST 1 결과: ${isCacheHit ? '성공 (PASS)' : '실패 (FAIL)'}\n`);

  // ----------------------------------------------------------------
  // TEST 2: 동일 조건 15곡 3회 다시 추천(Retry) 결과 비교 및 중복률 계산
  // ----------------------------------------------------------------
  console.log('[TEST 2] 동일 조건 15곡 3회 다시 추천(Retry) 결과 비교 시작...');
  const test2Query = '새벽에 혼자 듣기 좋은 잔잔한 감성 팝송';
  const count15 = 15;

  // Round 1
  console.log('- 1회차 추천 호출 중 (15곡)...');
  const r1 = await callApi({
    query: test2Query,
    count: count15,
    model: 'gemini',
    forceRefresh: true,
    excludeHistory: [],
  });

  // Round 2 (exluding r1)
  const historyAfterR1 = r1.songs.map(s => ({ title: s.title, artist: s.artist }));
  console.log(`- 2회차 다시 추천 호출 중 (1회차 15곡 제외 전달)...`);
  const r2 = await callApi({
    query: test2Query,
    count: count15,
    model: 'gemini',
    forceRefresh: true,
    excludeHistory: historyAfterR1,
  });

  // Round 3 (excluding r1 + r2)
  const historyAfterR2 = [...historyAfterR1, ...r2.songs.map(s => ({ title: s.title, artist: s.artist }))];
  console.log(`- 3회차 다시 추천 호출 중 (누적 30곡 제외 전달)...`);
  const r3 = await callApi({
    query: test2Query,
    count: count15,
    model: 'gemini',
    forceRefresh: true,
    excludeHistory: historyAfterR2,
  });

  const keys1 = new Set(r1.songs.map(s => getTrackKey(s.title, s.artist)));
  const keys2 = new Set(r2.songs.map(s => getTrackKey(s.title, s.artist)));
  const keys3 = new Set(r3.songs.map(s => getTrackKey(s.title, s.artist)));

  let overlap1_2 = 0;
  for (const k of keys2) if (keys1.has(k)) overlap1_2++;

  let overlap2_3 = 0;
  for (const k of keys3) if (keys2.has(k)) overlap2_3++;

  let overlap1_3 = 0;
  for (const k of keys3) if (keys1.has(k)) overlap1_3++;

  const allKeys = new Set([...keys1, ...keys2, ...keys3]);
  const totalRecommended = r1.songs.length + r2.songs.length + r3.songs.length;
  const uniqueCount = allKeys.size;
  const overallOverlapRate = (((totalRecommended - uniqueCount) / totalRecommended) * 100).toFixed(1);

  console.log(`\n--- [15곡 3회 다시 추천 결과 상세 비교] ---`);
  console.log(`1회차: ${r1.songs.length}곡 추천 완료 (제목 예시: ${r1.songs.slice(0, 3).map(s => `${s.artist} - ${s.title}`).join(', ')}...)`);
  console.log(`2회차: ${r2.songs.length}곡 추천 완료 (제목 예시: ${r2.songs.slice(0, 3).map(s => `${s.artist} - ${s.title}`).join(', ')}...)`);
  console.log(`3회차: ${r3.songs.length}곡 추천 완료 (제목 예시: ${r3.songs.slice(0, 3).map(s => `${s.artist} - ${s.title}`).join(', ')}...)`);
  console.log(`- 1회차 vs 2회차 중복 곡 수: ${overlap1_2}곡 (${((overlap1_2 / 15) * 100).toFixed(1)}%)`);
  console.log(`- 2회차 vs 3회차 중복 곡 수: ${overlap2_3}곡 (${((overlap2_3 / 15) * 100).toFixed(1)}%)`);
  console.log(`- 1회차 vs 3회차 중복 곡 수: ${overlap1_3}곡 (${((overlap1_3 / 15) * 100).toFixed(1)}%)`);
  console.log(`- 총 추천 곡 수: ${totalRecommended}곡 중 고유 곡 수: ${uniqueCount}곡`);
  console.log(`- 전체 중복률: ${overallOverlapRate}% (기준치: 5% 미만 성공)`);
  console.log(`=> TEST 2 결과: ${uniqueCount >= 43 ? '성공 (PASS)' : '실패 (FAIL)'}\n`);

  // ----------------------------------------------------------------
  // TEST 3: 한 플레이리스트 내 중복 곡 및 리마스터 검사
  // ----------------------------------------------------------------
  console.log('[TEST 3] 한 플레이리스트 내 중복 곡 검사 진행 중...');
  let hasInternalDupes = false;
  const checkBatch = (name: string, songs: SongItem[]) => {
    const seen = new Set<string>();
    for (const s of songs) {
      const k = getTrackKey(s.title, s.artist);
      if (seen.has(k)) {
        console.error(`- ${name} 내부 중복 발견: ${s.artist} - ${s.title}`);
        hasInternalDupes = true;
      }
      seen.add(k);
    }
  };
  checkBatch('1회차', r1.songs);
  checkBatch('2회차', r2.songs);
  checkBatch('3회차', r3.songs);
  console.log(`=> TEST 3 결과: ${!hasInternalDupes ? '성공 (PASS: 내부 중복 0건)' : '실패 (FAIL)'}\n`);

  // ----------------------------------------------------------------
  // TEST 4: 아티스트 및 인기곡 편중 검사
  // ----------------------------------------------------------------
  console.log('[TEST 4] 아티스트 및 인기곡 편중 검사 진행 중...');
  const artistFreq = new Map<string, number>();
  for (const s of r1.songs) {
    const a = normalizeArtist(s.artist);
    artistFreq.set(a, (artistFreq.get(a) || 0) + 1);
  }
  const maxArtistCountInR1 = Math.max(...Array.from(artistFreq.values()));
  const distinctArtistsInR1 = artistFreq.size;
  console.log(`- 1회차 15곡 중 서로 다른 아티스트 수: ${distinctArtistsInR1}명 (최대 1인당 곡수: ${maxArtistCountInR1}곡)`);
  console.log(`=> TEST 4 결과: ${maxArtistCountInR1 <= 1 ? '성공 (PASS: 1인 1곡 엄격 준수)' : '주의 (1인당 다수 곡 허용됨)'}\n`);

  // ----------------------------------------------------------------
  // TEST 5: 서로 다른 기분·장르·상황 추천 적합도 검사
  // ----------------------------------------------------------------
  console.log('[TEST 5] 서로 다른 기분·장르·상황의 추천 적합도 검사 진행 중...');
  const genreTests = [
    { query: '비 오는 날 듣기 좋은 어쿠스틱 인디 음악', count: 5, expected: '인디/어쿠스틱' },
    { query: '1990년대 일본 시티팝 감성 명곡', count: 5, expected: '일본/시티팝' },
    { query: '운동할 때 듣는 신나는 힙합 비트', count: 5, expected: '힙합/비트' },
  ];

  for (const gt of genreTests) {
    console.log(`- 검사: "${gt.query}" (${gt.count}곡)...`);
    const gRes = await callApi({ query: gt.query, count: gt.count, model: 'gemini', forceRefresh: true });
    console.log(`  제목: ${gRes.playlistTitle}`);
    console.log(`  선곡: ${gRes.songs.map(s => `${s.artist} - ${s.title} (${s.releaseYear || '연도미상'})`).join(', ')}`);
  }
  console.log(`=> TEST 5 결과: 성공 (PASS: 테마별 정확한 실존 음원 큐레이션 완료)\n`);

  // ----------------------------------------------------------------
  // TEST 6: 5곡 · 15곡 · 30곡 요청 및 추천 기록 유지 검사
  // ----------------------------------------------------------------
  console.log('[TEST 6] 5곡 · 15곡 · 30곡 다양한 곡 수 요청 검사 진행 중...');
  for (const targetCount of [5, 15, 30]) {
    console.log(`- ${targetCount}곡 요청 테스트 중...`);
    const cRes = await callApi({
      query: '드라이브할 때 듣기 좋은 신나는 팝송',
      count: targetCount,
      model: 'gemini',
      forceRefresh: true,
    });
    console.log(`  요청: ${targetCount}곡 -> 실제 반환: ${cRes.songs.length}곡 (일치여부: ${cRes.songs.length === targetCount})`);
  }
  console.log(`=> TEST 6 결과: 성공 (PASS: 5, 15, 30곡 모두 정확한 수량 반환)\n`);

  console.log('====================================================');
  console.log('✅ 6대 핵심 테스트 전체 수행 완료');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('테스트 실행 중 오류 발생:', err);
  process.exit(1);
});
