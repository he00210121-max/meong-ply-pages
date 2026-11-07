import React, { useState } from 'react';
import { PlaylistResult, SongItem } from '../types';
import { ArrowLeft, ExternalLink, Copy, Check, RotateCw, Music2, Share2, Youtube, ListMusic } from 'lucide-react';

interface ResultScreenProps {
  result: PlaylistResult;
  onReset: () => void;
  onRetry: () => void;
  originalQuery: string;
  recentHistoryCount?: number;
  onClearHistory?: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  onReset,
  onRetry,
  originalQuery,
  recentHistoryCount = 0,
  onClearHistory,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyAll = () => {
    const textLines = [
      `👑 멍플리 AI 추천 플레이리스트: ${result.playlistTitle}`,
      `📌 테마: ${result.playlistDescription}`,
      `🎧 요청: "${originalQuery}"`,
      '',
      ...result.songs.map(
        (s) => `${s.number}. ${s.title} - ${s.artist} (추천 이유: ${s.reason})`
      ),
      '',
      '멍플리에서 추천받은 플레이리스트입니다 🐾'
    ].join('\n');

    navigator.clipboard.writeText(textLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopySingle = (song: SongItem, idx: number) => {
    const text = `${song.title} - ${song.artist}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const getYouTubeSearchUrl = (song: SongItem) => {
    const query = song.youtubeSearchQuery || `${song.artist} - ${song.title}`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  };

  const getYouTubePlaylistSearchUrl = () => {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(result.playlistTitle)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-10">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>다른 분위기 찾아보기</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {recentHistoryCount > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 rounded-xl border border-stone-900/60 shadow-[1px_1px_0px_#1c1917] text-stone-700">
              <span className="select-none">🐾</span>
              <span>최근 추천 <strong>{recentHistoryCount}곡</strong> 중복 방지 중</span>
              {onClearHistory && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="ml-1 text-[11px] underline text-stone-500 hover:text-amber-900 cursor-pointer"
                  title="브라우저에 저장된 최근 추천 곡 목록을 초기화합니다"
                >
                  기록 비우기
                </button>
              )}
            </div>
          )}

          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-stone-800 bg-amber-100 hover:bg-amber-200 rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>이 조건으로 다시 추천</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-500 rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-stone-900" />
                <span>목록 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>전체 곡 목록 복사</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Playlist Header Card */}
      <div className="bg-white rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_#1c1917] p-6 sm:p-8 mb-8 relative overflow-hidden">
        {/* Playful character avatar badge in top right */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-stone-200">
          <div className="flex-1">
            {/* Metadata info with clean unboxed discipline */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500 mb-2">
              <span className="text-amber-800 font-bold">멍플리 AI 선곡집</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-bold text-stone-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                {result.requestedCount && result.requestedCount !== result.songs.length
                  ? `요청 ${result.requestedCount}곡 중 ${result.songs.length}곡 엄선`
                  : `슬라이더 ${result.songs.length}곡 추천 완료`}
              </span>
              {result.modelUsed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[11px] font-bold">
                    <span>🤖</span>
                    <span>{result.modelUsed}</span>
                  </span>
                </>
              )}
              {result.executionTimeMs !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-stone-700 font-mono font-bold bg-white px-2 py-0.5 rounded border border-stone-200">
                    소요시간: {(result.executionTimeMs / 1000).toFixed(2)}초
                  </span>
                </>
              )}
              {result.tokenUsage && (
                <>
                  <span aria-hidden="true">·</span>
                  {result.source === 'cache' || result.tokenUsage.isCached ? (
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 text-[11px]">
                      ⚡ 캐시 적중 (토큰 0 소모)
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-stone-700 font-mono font-bold bg-stone-100 px-2 py-0.5 rounded border border-stone-300 text-[11px]"
                      title={`입력: ${result.tokenUsage.promptTokens} / 출력: ${result.tokenUsage.completionTokens}`}
                    >
                      ⚡ 토큰: {result.tokenUsage.totalTokens} (출력 {result.tokenUsage.completionTokens})
                    </span>
                  )}
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">{result.tags?.slice(0, 3).join(' / ')}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight leading-snug">
              {result.playlistTitle}
            </h1>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              {result.playlistDescription}
            </p>

            <div className="mt-4 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 inline-flex flex-wrap items-center gap-2">
              <span className="font-bold text-stone-700">분석된 요청:</span>
              <span className="italic">"{originalQuery}"</span>
              {result.requestedCount && (
                <span className="ml-1 text-[11px] font-mono bg-amber-100 text-stone-800 font-bold px-2 py-0.5 rounded border border-amber-300">
                  슬라이더 설정: {result.requestedCount}곡
                </span>
              )}
            </div>

            {/* Notice if generated count is less than requested count */}
            {result.requestedCount && result.songs.length < result.requestedCount && (
              <div className="mt-3.5 p-3.5 bg-amber-50 border-2 border-stone-900 shadow-[2px_2px_0px_#1c1917] rounded-xl text-xs text-stone-900 flex items-start gap-2.5">
                <span className="text-base select-none shrink-0">🐾</span>
                <div className="leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-0.5">
                    <span>추천 곡 수 안내</span>
                    <span className="text-[10px] bg-amber-200 border border-stone-900 px-1.5 py-0.2 rounded font-mono">
                      {result.songs.length} / {result.requestedCount}곡
                    </span>
                  </div>
                  {result.shortageReason ? (
                    <p className="mt-1 text-stone-700 leading-relaxed">{result.shortageReason}</p>
                  ) : (
                    <p className="mt-1 text-stone-700 leading-relaxed">
                      슬라이더로 지정하신 <strong>{result.requestedCount}곡</strong> 중, 요청 조건에 가장 부합하는 정식 실존 음원 <strong>{result.songs.length}곡</strong>을 엄선하여 안내해 드립니다.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Verification Report Card - Honest disclosure without false verification claims (Requirement 4) */}
            {result.verification && (
              <div className="mt-4 p-3.5 bg-amber-50/80 rounded-xl border border-stone-900 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-stone-900 flex items-center gap-1.5">
                    <span>🐾 조건 분석 리포트</span>
                  </span>
                  <span className="bg-stone-100 text-stone-700 border border-stone-400 px-2 py-0.5 rounded-md font-bold text-[10px]">
                    AI 지식 기반 분석 (YouTube API 직접 대조 미연동)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-stone-700">
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px] font-sans">국가/지역 조건</span>
                    <span className="font-bold text-stone-900 truncate block">{result.verification.countryCondition}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px] font-sans">장르 조건</span>
                    <span className="font-bold text-stone-900 truncate block">{result.verification.genreCondition}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px] font-sans">발매 시대</span>
                    <span className="font-bold text-stone-900 truncate block">{result.verification.eraCondition}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px] font-sans">가사/보컬 여부</span>
                    <span className="font-bold text-stone-900 truncate block">{result.verification.vocalCondition}</span>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 pt-1 leading-normal">
                  ※ YouTube 정식 Data API 직접 대조 검증 기능은 미연동 상태이며, AI 모델의 학습 지식을 기반으로 추출된 정보입니다. 각 곡의 '유튜브에서 감상하기'를 누르면 해당 곡의 정식 검색 페이지로 이동합니다.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-row sm:flex-col items-center gap-4">
            {/* Dog image is static by default, responds only to hover (Rules 2 & 3) */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-50 border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] p-1.5 flex items-center justify-center relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[4px_4px_0px_#1c1917]">
              <img
                src="/assets/dogs/dog_winking.png"
                alt="추천 완료! 윙크하는 멍플리"
                className="w-full h-full object-contain select-none transition-transform duration-200 ease-out group-hover:rotate-2 group-hover:scale-105"
              />
              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-300 text-stone-900 border border-stone-900 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-[1px_1px_0px_#1c1917] transition-transform duration-200 group-hover:rotate-6">
                선곡 완료! 🐾
              </div>
            </div>

            <a
              href={getYouTubePlaylistSearchUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold rounded-xl border border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:shadow-[1px_1px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              <Youtube className="w-4 h-4 fill-white" />
              <span>유튜브에서 테마 검색</span>
            </a>
          </div>
        </div>

        {/* Clean tags strip without pill clutter */}
        {result.tags && result.tags.length > 0 && (
          <div className="pt-4 flex flex-wrap items-center gap-3 text-xs text-stone-500">
            <span className="font-bold text-stone-700">선곡 무드:</span>
            {result.tags.map((tag, idx) => (
              <React.Fragment key={idx}>
                <span className="text-stone-700 font-medium hover:text-stone-950">
                  #{tag}
                </span>
                {idx < result.tags.length - 1 && <span aria-hidden="true" className="text-stone-300">·</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Song Recommendation List */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-2 mb-2">
          <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-amber-600" />
            <span>선곡 트랙 리스트 ({result.songs.length}곡)</span>
          </h2>
          <span className="text-xs text-stone-500">
            곡명을 누르면 유튜브 검색창으로 바로 이동합니다
          </span>
        </div>

        {result.songs.map((song, idx) => {
          const isSingleCopied = copiedIndex === idx;
          const youtubeUrl = getYouTubeSearchUrl(song);

          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:shadow-[5px_5px_0px_#f59e0b] hover:border-stone-900 p-4 sm:p-5 transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Left: Number & Song Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Track Number */}
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 border border-stone-900 flex items-center justify-center font-mono font-black text-xs text-stone-900 group-hover:bg-amber-300 transition-colors">
                    {String(song.number || idx + 1).padStart(2, '0')}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Title and Artist */}
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base sm:text-lg font-black text-stone-900 hover:text-amber-800 transition-colors flex items-center gap-1.5 group-hover:underline underline-offset-2"
                        title="YouTube에서 검색하기"
                      >
                        <span>{song.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <span className="text-stone-400 font-light">|</span>
                      <span className="text-sm font-semibold text-stone-700">
                        {song.artist}
                      </span>
                    </div>

                    {/* Metadata line with Country, Release Year, and Instrumental flags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-2">
                      {song.country && (
                        <span className="bg-stone-100 text-stone-800 font-bold px-1.5 py-0.5 rounded border border-stone-300 text-[11px]">
                          {song.country}
                        </span>
                      )}
                      {song.releaseYear && (
                        <span className="bg-amber-100 text-amber-950 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-300 text-[11px]">
                          {song.releaseYear}년
                        </span>
                      )}
                      {song.isInstrumental !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${
                          song.isInstrumental
                            ? 'bg-amber-50 text-stone-900 border-amber-400'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}>
                          {song.isInstrumental ? '연주곡 (가사 없음)' : '보컬곡'}
                        </span>
                      )}
                      {song.isCover && (
                        <span className="bg-purple-100 text-purple-950 font-bold px-1.5 py-0.5 rounded border border-purple-300 text-[11px]">
                          커버곡
                        </span>
                      )}
                      {song.genre && <span>· {song.genre}</span>}
                      {song.vibe && <span className="text-stone-600 font-medium hidden sm:inline">({song.vibe})</span>}
                    </div>

                    {/* Recommendation Reason (추천 이유) */}
                    <div className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 mt-2">
                      <span className="font-bold text-amber-900 mr-1.5 select-none">
                        💡 멍플리의 추천 이유:
                      </span>
                      <span>{song.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  {/* YouTube Search Button */}
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 whitespace-nowrap cursor-pointer"
                  >
                    <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                    <span>YouTube 검색</span>
                  </a>

                  {/* Copy Song Title */}
                  <button
                    type="button"
                    onClick={() => handleCopySingle(song, idx)}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap hover:scale-[1.03] active:scale-95 cursor-pointer"
                    title="제목과 가수 복사"
                  >
                    {isSingleCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>곡명 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky-free CTA Bar */}
      <div className="mt-10 p-6 bg-white rounded-3xl border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] text-center">
        <h3 className="text-base font-extrabold text-stone-900 mb-2">
          마음에 드는 다른 분위기의 음악도 찾아보세요!
        </h3>
        <p className="text-xs text-stone-500 mb-4 max-w-md mx-auto">
          언제든 새로운 장르, 상황, 곡 수를 입력해 나만의 플레이리스트를 만들어 보세요.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onReset}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-900 font-black text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:shadow-[1px_1px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            새로운 추천 받기
          </button>
          <button
            onClick={handleCopyAll}
            className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            플레이리스트 전체 복사하기
          </button>
        </div>
      </div>
    </div>
  );
};
