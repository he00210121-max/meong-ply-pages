import React, { useState } from 'react';
import { Wand2, ArrowRight, Check, ChevronDown, SlidersHorizontal, Cpu, Sparkles, Mic2, Disc, Filter, Globe, Music } from 'lucide-react';
import { DetailedOptions, RecommendationModel } from '../types';

export interface SearchParams {
  query: string;
  count: number;
  model: RecommendationModel;
  options: DetailedOptions;
}

interface InputScreenProps {
  onSearch: (params: SearchParams) => void;
  initialQuery?: string;
  initialCount?: number;
  initialModel?: RecommendationModel;
  recentHistoryCount?: number;
  onClearHistory?: () => void;
}

const QUICK_EXAMPLES = [
  {
    label: "밤에 듣기 좋은 잔잔한 팝송",
    desc: "새벽 감성 · 몽환적인 팝 · 잔잔함",
  },
  {
    label: "공부할 때 듣기 좋은 가사 없는 피아노 연주곡",
    desc: "집중력 향상 · 잔잔한 선율 · 피아노",
  },
  {
    label: "비 오는 날 듣는 감성 인디 음악",
    desc: "빗소리와 함께 · 감성 어쿠스틱 · 인디",
  },
  {
    label: "운동할 때 듣는 신나는 힙합",
    desc: "고강도 트레이닝 · 빠른 비트 · 힙합",
  },
  {
    label: "몽환적인 일본 시티팝",
    desc: "레트로 감성 · 청량한 신스사운드 · 시티팝",
  },
  {
    label: "잘 알려지지 않은 감성적인 노래",
    desc: "나만 알고 싶은 숨은 명곡 · 감성 보컬",
  },
];

const SITUATION_TAGS = [
  "공부할 때",
  "밤에 잠들기 전",
  "비 오는 날",
  "운동할 때",
  "새벽에 드라이브할 때",
  "카페에서 작업할 때",
  "조용히 책 읽을 때",
];

const MOOD_TAGS = [
  "잔잔한 & 나른한",
  "신나는 & 활기찬",
  "새벽 감성 & 몽환적",
  "가사 없는 차분한",
  "따뜻한 위로 & 힐링",
  "그루브 넘치는",
];

const GENRE_TAGS = [
  "팝 (Pop)",
  "인디 / 어쿠스틱",
  "재즈 (Jazz)",
  "피아노 연주곡",
  "일본 시티팝",
  "K-POP",
  "R&B / 소울",
  "로파이 (Lo-Fi)",
  "힙합 (Hip-Hop)",
];

const ERA_TAGS = [
  { label: "전체 시대", value: "" },
  { label: "1980년대", value: "1980년대" },
  { label: "1990년대", value: "1990년대" },
  { label: "2000년대", value: "2000년대" },
  { label: "2010년대", value: "2010년대" },
  { label: "최신 음악", value: "2020년대 최신" },
];

const REGION_TAGS = [
  { label: "전체 지역", value: "" },
  { label: "🇰🇷 한국", value: "한국" },
  { label: "🇯🇵 일본", value: "일본" },
  { label: "🇺🇸 미국/글로벌", value: "미국" },
  { label: "🇬🇧 영국", value: "영국" },
];

export const InputScreen: React.FC<InputScreenProps> = ({
  onSearch,
  initialQuery = '',
  initialCount = 10,
  initialModel = 'gemini',
  recentHistoryCount = 0,
  onClearHistory,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCount, setSelectedCount] = useState<number>(Math.min(Math.max(initialCount, 5), initialModel === 'groq' ? 10 : 30));
  const [selectedModel, setSelectedModel] = useState<RecommendationModel>(initialModel);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedEra, setSelectedEra] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [vocalPreference, setVocalPreference] = useState<'all' | 'vocal' | 'instrumental'>('all');
  const [coverPreference, setCoverPreference] = useState<'any' | 'original' | 'cover'>('any');
  const [includeAiMusic, setIncludeAiMusic] = useState<boolean>(false);
  const [popularity, setPopularity] = useState<'any' | 'popular' | 'hidden'>('any');
  const [excludedMusic, setExcludedMusic] = useState<string>('');

  const [isOptionsOpen, setIsOptionsOpen] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(true);

  // Detect accidental song count phrases in query (e.g. '10곡', '20개', '5트랙')
  // Decades like '1990년대', '2000년대', '80년대' do not match because they end with '년대'.
  const detectedCountInQuery = React.useMemo(() => {
    const match = /(?:^|\s|[^\d\w가-힣])(\d{1,2})\s*(?:곡|개|트랙)/.exec(query);
    return match ? match[1] : null;
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    onSearch({
      query: query.trim(),
      count: selectedCount,
      model: selectedModel,
      options: {
        model: selectedModel,
        includeAiMusic,
        vocalPreference,
        vibe: selectedMood,
        genre: selectedGenre,
        era: selectedEra,
        region: selectedRegion,
        popularity,
        coverPreference,
        excludedMusic: excludedMusic.trim() || undefined,
      },
    });
  };

  const handleSelectExample = (exampleText: string) => {
    // Preserve the user's slider setting; do not embed or change song count
    setQuery(exampleText);
  };

  const handleToggleMood = (mood: string) => {
    if (selectedMood === mood) {
      setSelectedMood('');
    } else {
      setSelectedMood(mood);
      if (!query.includes(mood)) {
        setQuery(prev => prev ? `${prev} / ${mood}` : `${mood} 분위기의 음악`);
      }
    }
  };

  const handleToggleGenre = (genre: string) => {
    if (selectedGenre === genre) {
      setSelectedGenre('');
    } else {
      setSelectedGenre(genre);
      if (!query.includes(genre)) {
        setQuery(prev => prev ? `${prev} / ${genre}` : `${genre} 장르 음악`);
      }
    }
  };

  const handleBuildPrompt = (situation: string, mood?: string, genre?: string) => {
    const parts = [situation];
    if (mood) parts.push(mood);
    if (genre) parts.push(genre);
    const sentence = `${parts.join(' ')} 음악`;
    setQuery(sentence);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-10">
      {/* Hero Character Card: Doodle style yellow golden retriever with crown */}
      <div className="bg-white rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_#1c1917] p-6 sm:p-10 mb-10 overflow-hidden relative">
        <div className="absolute top-4 right-6 select-none opacity-20 hidden sm:block pointer-events-none font-mono text-xs">
          <span>♫ ♬ ♪ ♩</span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10">
          {/* Retriever Character Container - Static normally, reacts only on hover */}
          <div className="shrink-0 flex flex-col items-center group cursor-pointer">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-amber-50 border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] overflow-hidden flex items-center justify-center p-2 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[5px_5px_0px_#1c1917] group-active:translate-y-0">
              {imgLoaded ? (
                <img
                  src="/assets/dogs/dog_listening.png"
                  alt="왕관을 쓴 노란색 골든 리트리버 멍플리"
                  className="w-full h-full object-contain select-none transition-transform duration-200 ease-out group-hover:rotate-2 group-hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                  onError={() => setImgLoaded(false)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-amber-100 p-4 text-center">
                  <div className="text-4xl mb-2">👑🐕</div>
                  <span className="font-extrabold text-stone-900 text-sm">멍플리</span>
                  <span className="text-xs text-stone-600 mt-1">왕관 쓴 리트리버</span>
                </div>
              )}

              {/* Hand-drawn style badge */}
              <div className="absolute -bottom-1 -right-1 bg-amber-300 text-stone-900 border-2 border-stone-900 px-2 py-0.5 rounded-lg text-xs font-bold shadow-[2px_2px_0px_#1c1917] rotate-3 transition-transform duration-200 group-hover:rotate-6">
                DJ 멍플리 🐾
              </div>
            </div>

            <p className="mt-3 text-xs text-stone-500 font-medium text-center transition-colors duration-200 group-hover:text-stone-800">
              마우스를 올리면 멍플리가 반갑게 쳐다봐요!
            </p>
          </div>

          {/* Form and Prompt Area */}
          <div className="flex-1 w-full text-left">
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1.5">
                <span>회원가입 없이 바로 듣는 AI 유튜브 선곡소</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight text-balance leading-snug">
                어떤 음악을 원하시나요?
              </h1>
              <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                듣고 싶은 <strong className="text-stone-800 font-semibold">분위기</strong>, <strong className="text-stone-800 font-semibold">장르</strong>, <strong className="text-stone-800 font-semibold">상황</strong>을 편하게 적어주시면 딱 맞는 노래를 추천해 드릴게요. <span className="text-amber-800 font-medium">(곡 수는 아래 가로 슬라이더에서만 조절됩니다!)</span>
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="예: 비 오는 새벽에 듣기 좋은 1990년대 일본 재즈 연주곡, 공부할 때 듣는 피아노..."
                  rows={3}
                  className="w-full px-4 py-3.5 text-stone-900 placeholder:text-stone-400 bg-stone-50 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] focus:outline-none focus:bg-white focus:shadow-[4px_4px_0px_#f59e0b] transition-all resize-none text-base"
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute top-3 right-3 text-xs text-stone-400 hover:text-stone-800 bg-stone-200 hover:bg-stone-300 rounded-full w-5 h-5 flex items-center justify-center font-bold transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                    title="지우기"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Informative banner if user typed a song count inside the prompt (Requirement 4) */}
              {detectedCountInQuery && (
                <div className="flex items-center gap-2 text-xs text-amber-950 bg-amber-100/90 px-3.5 py-2 rounded-xl border border-amber-400 shadow-[1px_1px_0px_#1c1917]">
                  <span className="text-sm select-none">🐾</span>
                  <p className="leading-snug">
                    문장 속 <strong>"{detectedCountInQuery}곡"</strong>은 무시되며, 슬라이더 설정(<strong>{selectedCount}곡</strong>)이 우선 적용됩니다. (시대 연도는 안전하게 보존)
                  </p>
                </div>
              )}

              {recentHistoryCount > 0 && !detectedCountInQuery && (
                <div className="flex items-center justify-between text-xs text-stone-700 bg-amber-50/60 px-3.5 py-1.5 rounded-xl border border-amber-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm select-none">🐾</span>
                    <span>최근 추천받은 <strong>{recentHistoryCount}곡</strong>을 기억하여 중복 없이 새로운 곡을 추천합니다.</span>
                  </div>
                  {onClearHistory && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-[11px] underline text-stone-500 hover:text-stone-900 cursor-pointer shrink-0 ml-2"
                      title="추천 기록을 비우면 처음 상태로 추천받을 수 있습니다"
                    >
                      기록 지우기
                    </button>
                  )}
                </div>
              )}

              {/* Action Bar: Current Count Setting Display, Active Model Badge & Main Submit Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-stone-700 whitespace-nowrap">
                    추천 설정:
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-stone-900 font-bold text-xs rounded-xl border border-stone-900 shadow-[1px_1px_0px_#1c1917]">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                    <span>선택된 곡 수:</span>
                    <span className="font-mono text-amber-950 font-extrabold">{selectedCount}곡</span>
                  </div>

                  {/* Active AI Engine Badge */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl border shadow-[1px_1px_0px_#1c1917] ${
                    selectedModel === 'groq'
                      ? 'bg-orange-100 text-orange-950 border-stone-900'
                      : 'bg-blue-50 text-blue-950 border-stone-900'
                  }`}>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>{selectedModel === 'groq' ? 'Groq Qwen 3.8' : 'Gemini 3.8'}</span>
                  </div>
                </div>

                {/* Submit Button with ~3% hover scale per rule 3 */}
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="w-full sm:w-auto px-7 py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-stone-200 text-stone-900 disabled:text-stone-400 font-extrabold text-base rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] hover:shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 disabled:hover:scale-100 disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  <Wand2 className="w-5 h-5" />
                  <span>추천하기</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Expandable Detailed Settings (Slider, AI Engine Selector, Deep Criteria) */}
        <div className="mt-6 pt-5 border-t border-stone-200/80">
          <button
            type="button"
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className="w-full flex items-center justify-between text-xs font-bold text-stone-700 hover:text-amber-900 py-1 transition-colors duration-200 group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform duration-200" />
              <span>상세 선곡 옵션 (AI 모델 비교 · 곡 수 슬라이더 · 가사 · 시대 · 커버곡)</span>
              <span className="ml-1 text-[11px] font-mono bg-amber-200 text-amber-950 font-bold px-1.5 py-0.5 rounded border border-amber-400">
                {selectedCount}곡
              </span>
            </div>
            <div className="flex items-center gap-1 text-stone-500 group-hover:text-amber-900 transition-colors duration-200">
              <span className="text-[11px] font-medium">{isOptionsOpen ? '접기' : '펼치기'}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isOptionsOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </div>
          </button>

          {isOptionsOpen && (
            <div className="mt-4 space-y-4 pt-1">
              {/* 1. Developer Test AI Model Selection (Requirement 1 & 2) */}
              <div className="bg-stone-50 p-4 rounded-2xl border-2 border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-stone-800" />
                    <span className="text-xs font-bold text-stone-900">개발자 테스트 설정: AI 추천 모델 비교</span>
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    현재 엔진: <strong>{selectedModel === 'groq' ? 'Groq Qwen' : 'Gemini'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModel('gemini')}
                    className={`p-3 rounded-xl border-2 text-left transition-all duration-200 flex items-start justify-between cursor-pointer ${
                      selectedModel === 'gemini'
                        ? 'bg-blue-50 border-stone-900 shadow-[2px_2px_0px_#1c1917]'
                        : 'bg-white border-stone-300 hover:border-stone-500 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                        <span>Gemini 3.8 Flash</span>
                        <span className="text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-medium">기본 방식</span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1">Google AI 기반의 균형 잡힌 음악 추천</p>
                    </div>
                    {selectedModel === 'gemini' && <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel('groq');
                      setSelectedCount(count => Math.min(count, 10));
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all duration-200 flex items-start justify-between cursor-pointer ${
                      selectedModel === 'groq'
                        ? 'bg-orange-50 border-stone-900 shadow-[2px_2px_0px_#1c1917]'
                        : 'bg-white border-stone-300 hover:border-stone-500 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                        <span>Groq Qwen 3.8 (27B)</span>
                        <span className="text-[10px] bg-orange-100 text-orange-900 px-1.5 py-0.2 rounded font-medium">초고속 테스트</span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1">Groq LPU 기반의 초저지연 LLM 선곡 엔진</p>
                    </div>
                    {selectedModel === 'groq' && <Check className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  ※ 두 모델의 응답 속도와 선곡 품질을 직접 비교해 보실 수 있습니다. (기본 모델: Gemini)
                </p>
              </div>

              {/* 2. Horizontal Slider for Song Count (5~30곡) */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border-2 border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-stone-900">추천 곡 수 조절 (가로 슬라이더)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-stone-600 font-medium">현재 선택:</span>
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-amber-400 text-stone-950 font-extrabold text-sm border border-stone-900 shadow-[1px_1px_0px_#1c1917] font-mono">
                      {selectedCount}곡
                    </span>
                  </div>
                </div>

                <div className="pt-2 pb-1">
                  <input
                    type="range"
                    min={5}
                    max={selectedModel === 'groq' ? 10 : 30}
                    step={1}
                    value={selectedCount}
                    onChange={(e) => setSelectedCount(Number(e.target.value))}
                    className="song-count-slider w-full h-3 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-stone-900/60 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    aria-label={`추천 곡 수 (5곡 ~ ${selectedModel === 'groq' ? 10 : 30}곡)`}
                  />
                  <div className="relative h-8 mx-2 text-[11px] text-stone-500 font-mono mt-1">
                    {(selectedModel === 'groq' ? [5, 10] : [5, 10, 15, 20, 25, 30]).map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSelectedCount(count)}
                        className={`absolute top-0 -translate-x-1/2 px-1 py-1 cursor-pointer ${selectedCount === count ? 'font-bold text-amber-800' : ''}`}
                        style={{ left: `${((count - 5) / (selectedModel === 'groq' ? 5 : 25)) * 100}%` }}
                        aria-label={`${count}곡 선택`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedModel === 'groq' && (
                  <p className="text-[11px] text-amber-800 font-medium">Groq는 최대 10곡까지 추천할 수 있어요</p>
                )}
                <p className="text-[11px] text-stone-500 leading-normal">
                  💡 입력 문장에 곡 수를 적지 않아도 위 슬라이더의 설정(<strong className="text-stone-800">{selectedCount}곡</strong>)이 AI 추천에 최우선 적용됩니다.
                </p>
              </div>

              {/* 3. Deep Music Criteria Grid: Lyrics/Vocal, Era, Region, Cover, AI Music */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Vocal / Lyrics Preference */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                    <Mic2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>가사 및 보컬 설정</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { key: 'all', label: '전체 (상관 없음)' },
                      { key: 'vocal', label: '보컬곡만' },
                      { key: 'instrumental', label: '순수 연주곡만' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setVocalPreference(opt.key as any)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          vocalPreference === opt.key
                            ? 'bg-stone-900 text-white border-stone-900 font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover Song Preference */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                    <Disc className="w-3.5 h-3.5 text-amber-700" />
                    <span>커버곡 설정</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { key: 'any', label: '상관 없음' },
                      { key: 'original', label: '원곡 위주' },
                      { key: 'cover', label: '커버곡 전문' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCoverPreference(opt.key as any)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          coverPreference === opt.key
                            ? 'bg-amber-400 text-stone-900 border-stone-900 font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Era / Decade Preference */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>시대 및 발매 연대</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ERA_TAGS.map((era) => (
                      <button
                        key={era.label}
                        type="button"
                        onClick={() => setSelectedEra(selectedEra === era.value ? '' : era.value)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          selectedEra === era.value
                            ? 'bg-stone-900 text-white border-stone-900 font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {era.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Country / Region Preference */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                    <Globe className="w-3.5 h-3.5 text-amber-700" />
                    <span>국가 및 지역</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {REGION_TAGS.map((reg) => (
                      <button
                        key={reg.label}
                        type="button"
                        onClick={() => setSelectedRegion(selectedRegion === reg.value ? '' : reg.value)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          selectedRegion === reg.value
                            ? 'bg-amber-400 text-stone-900 border-stone-900 font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {reg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. AI Music & Excluded Music Filter */}
              <div className="bg-white p-3.5 rounded-2xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-stone-800">
                    <input
                      type="checkbox"
                      checked={includeAiMusic}
                      onChange={(e) => setIncludeAiMusic(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-stone-400"
                    />
                    <span>AI 생성 음악 포함 허용 (기본: 실제 발매 실존 음원만 선곡)</span>
                  </label>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-stone-500 font-medium">유명도:</span>
                    {[
                      { key: 'any', label: '전체' },
                      { key: 'popular', label: '인기 명곡' },
                      { key: 'hidden', label: '숨은 명곡' },
                    ].map((pop) => (
                      <button
                        key={pop.key}
                        type="button"
                        onClick={() => setPopularity(pop.key as any)}
                        className={`px-2 py-0.5 text-xs rounded border transition-all cursor-pointer ${
                          popularity === pop.key
                            ? 'bg-stone-900 text-white font-bold'
                            : 'bg-stone-100 text-stone-600 border-stone-300'
                        }`}
                      >
                        {pop.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                  <Filter className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <input
                    type="text"
                    value={excludedMusic}
                    onChange={(e) => setExcludedMusic(e.target.value)}
                    placeholder="제외할 아티스트 또는 장르 (예: 트로트, 특정 가수명)"
                    className="w-full text-xs px-3 py-1.5 bg-stone-50 rounded-xl border border-stone-300 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* 5. Prompt Helper: Situations, Moods, Genres */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-stone-500 mr-1 whitespace-nowrap font-medium">상황 태그:</span>
                  {SITUATION_TAGS.map((sit) => {
                    const isActive = query.includes(sit);
                    return (
                      <button
                        key={sit}
                        type="button"
                        onClick={() => handleBuildPrompt(sit, selectedMood, selectedGenre)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all duration-200 whitespace-nowrap hover:scale-[1.03] active:scale-95 cursor-pointer ${
                          isActive
                            ? 'bg-amber-300 text-stone-900 border-stone-900 shadow-[2px_2px_0px_#1c1917] font-bold'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 inline mr-1" />}
                        {sit}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-stone-500 mr-1 whitespace-nowrap font-medium">분위기:</span>
                  {MOOD_TAGS.map((mood) => {
                    const isActive = selectedMood === mood;
                    return (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => handleToggleMood(mood)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all duration-200 whitespace-nowrap hover:scale-[1.03] active:scale-95 cursor-pointer ${
                          isActive
                            ? 'bg-stone-900 text-white border-stone-900 shadow-[2px_2px_0px_#f59e0b]'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 inline mr-1" />}
                        {mood}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-stone-500 mr-1 whitespace-nowrap font-medium">장르:</span>
                  {GENRE_TAGS.map((genre) => {
                    const isActive = selectedGenre === genre;
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => handleToggleGenre(genre)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all duration-200 whitespace-nowrap hover:scale-[1.03] active:scale-95 cursor-pointer ${
                          isActive
                            ? 'bg-amber-400 text-stone-900 border-stone-900 shadow-[2px_2px_0px_#1c1917] font-bold'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 inline mr-1" />}
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popular Example Prompts Section (Hover only reaction) */}
      <div id="popular-examples" className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              바로 추천받기 좋은 인기 테마
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              원하는 테마를 누르면 바로 선곡 질문으로 적용됩니다 (곡 수는 슬라이더 설정 유지)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {QUICK_EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectExample(ex.label)}
              className="group text-left p-4 bg-white hover:bg-amber-50/60 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:shadow-[5px_5px_0px_#1c1917] hover:-translate-y-0.5 hover:scale-[1.01] active:scale-95 transition-all duration-200 flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                    인기 테마 🐾
                  </span>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-amber-900 transition-colors duration-200 line-clamp-2">
                  {ex.label}
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-3 pt-2 border-t border-stone-100">
                {ex.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Feature notice card */}
      <div className="mt-8 p-4 bg-amber-100/60 rounded-2xl border border-stone-900/40 text-stone-700 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-base select-none">🐾</span>
          <span>
            멍플리는 불필요한 회원가입 없이 누구나 무료로 나만의 유튜브 플레이리스트를 찾을 수 있는 AI 큐레이터입니다.
          </span>
        </div>
        <span className="shrink-0 font-bold text-stone-900">v1.2 (Groq Qwen 연동)</span>
      </div>
    </div>
  );
};
