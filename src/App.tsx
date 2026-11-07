/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { InputScreen, SearchParams } from './components/InputScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { InfoModal } from './components/InfoModal';
import { PlaylistResult, ScreenState, RecommendationModel, DetailedOptions } from './types';
import { getRecentHistory, saveToHistory, clearHistory } from './utils/trackHistory.ts';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('input');
  const [query, setQuery] = useState<string>('');
  const [count, setCount] = useState<number>(10);
  const [model, setModel] = useState<RecommendationModel>('gemini');
  const [detailedOptions, setDetailedOptions] = useState<DetailedOptions>({});
  const [result, setResult] = useState<PlaylistResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [searchStartTime, setSearchStartTime] = useState<number>(0);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [recentHistoryCount, setRecentHistoryCount] = useState<number>(() => getRecentHistory().length);

  const clientCache = React.useRef<Record<string, PlaylistResult>>({});

  const handleSearch = async (
    params: SearchParams,
    forceRefresh: boolean = false
  ) => {
    const { query: searchQuery, count: targetCount, model: targetModel, options } = params;

    setQuery(searchQuery);
    setCount(targetCount);
    setModel(targetModel);
    setDetailedOptions(options);

    const recentHistory = getRecentHistory();
    setRecentHistoryCount(recentHistory.length);

    const optionsKey = `${options.vibe || ''}_${options.genre || ''}_${options.era || ''}_${options.region || ''}_${options.vocalPreference || ''}_${options.coverPreference || ''}_${options.includeAiMusic || ''}_${options.popularity || ''}_${options.excludedMusic || ''}`;
    const cacheKey = `v10_${targetModel}_${searchQuery.trim().toLowerCase()}_${targetCount}_${optionsKey.toLowerCase()}`;

    // Instant client-side cache hit only on clean, non-force, no-history queries
    if (!forceRefresh && recentHistory.length === 0 && clientCache.current[cacheKey]) {
      setResult(clientCache.current[cacheKey]);
      setScreen('result');
      return;
    }

    if (forceRefresh) {
      delete clientCache.current[cacheKey];
    }

    const startTimestamp = Date.now();
    setSearchStartTime(startTimestamp);
    setIsDone(false);
    setScreen('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          count: targetCount,
          model: targetModel,
          includeAiMusic: options.includeAiMusic,
          vocalPreference: options.vocalPreference,
          vibe: options.vibe,
          genre: options.genre,
          era: options.era,
          region: options.region,
          popularity: options.popularity,
          coverPreference: options.coverPreference,
          excludedMusic: options.excludedMusic,
          excludeHistory: recentHistory.slice(0, 30),
          forceRefresh,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `서버 응답 오류 (상태 코드: ${response.status})`
        );
      }

      const data: PlaylistResult = await response.json();

      // Remember newly recommended tracks in browser local storage
      const updatedHistory = saveToHistory(data.songs);
      setRecentHistoryCount(updatedHistory.length);

      if (!forceRefresh && recentHistory.length === 0) {
        clientCache.current[cacheKey] = data;
      }

      setIsDone(true);
      setResult(data);
      setScreen('result');
    } catch (err: any) {
      console.error('추천 실패:', err);
      setErrorMessage(err?.message || '음악을 추천받는 도중 문제가 발생했습니다.');
      setScreen('error');
    }
  };

  const handleRetry = () => {
    if (query) {
      handleSearch(
        {
          query,
          count,
          model,
          options: detailedOptions,
        },
        true
      );
    } else {
      setScreen('input');
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    setRecentHistoryCount(0);
    clientCache.current = {};
  };

  const handleReset = () => {
    setScreen('input');
    setResult(null);
    setErrorMessage('');
    setIsDone(false);
    setSearchStartTime(0);
    setRecentHistoryCount(getRecentHistory().length);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans selection:bg-amber-200 selection:text-stone-900">
      {/* Top Bar Header */}
      <Header
        onGoHome={handleReset}
        onOpenInfo={() => setIsInfoOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 flex flex-col justify-center">
        {screen === 'input' && (
          <InputScreen
            onSearch={handleSearch}
            initialQuery={query}
            initialCount={count}
            initialModel={model}
            recentHistoryCount={recentHistoryCount}
            onClearHistory={handleClearHistory}
          />
        )}

        {screen === 'loading' && (
          <LoadingScreen
            query={query}
            count={count}
            startTime={searchStartTime || Date.now()}
            isDone={isDone}
          />
        )}

        {screen === 'result' && result && (
          <ResultScreen
            result={result}
            onReset={handleReset}
            onRetry={handleRetry}
            originalQuery={query}
            recentHistoryCount={recentHistoryCount}
            onClearHistory={handleClearHistory}
          />
        )}

        {screen === 'error' && (
          <ErrorScreen
            errorMessage={errorMessage}
            onRetry={handleRetry}
            onReset={handleReset}
            query={query}
          />
        )}
      </main>

      {/* Info Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-stone-200 py-8 px-4 text-center text-xs text-stone-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-stone-900">멍플리 (Meong-Ply)</span>
            <span aria-hidden="true">·</span>
            <span>AI 유튜브 플레이리스트 큐레이터</span>
          </div>
          <div className="text-stone-600 font-mono text-[11px]">
            Google Gemini 3.8 & Groq Qwen 3.8 듀얼 엔진 지원
          </div>
        </div>
      </footer>
    </div>
  );
}
