import React, { useEffect, useState } from 'react';
import { Loader2, Clock, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  query: string;
  count: number;
  startTime: number;
  isDone?: boolean;
  onCancel: () => void;
}

// Exact messages required by user in section 8
const LOADING_MESSAGES = [
  "멍플리가 음악을 찾고 있어요! 🐾",
  "원하는 분위기와 어울리는 노래를 고르고 있어요!",
  "좋은 음악을 발견하는 중이에요!",
  "플레이리스트를 완성하고 있어요!",
];

// Continuous alternating dog poses during loading (Section 4)
const SEARCHING_DOG_POSES = [
  {
    src: "/assets/dogs/dog_listening.png",
    alt: "헤드폰을 쓰고 음악을 듣는 멍플리",
    badge: "멜로디 청음 중 🎧",
  },
  {
    src: "/assets/dogs/dog_magnifying.png",
    alt: "돋보기를 들고 노래를 찾는 멍플리",
    badge: "트랙 탐색 중 🔍",
  },
  {
    src: "/assets/dogs/dog_running.png",
    alt: "신나게 뛰어다니며 명곡을 찾는 멍플리",
    badge: "선곡 창고 질주 🏃",
  },
  {
    src: "/assets/dogs/dog_laptop.png",
    alt: "노트북으로 플레이리스트를 정리하는 멍플리",
    badge: "플레이리스트 정리 💻",
  },
  {
    src: "/assets/dogs/dog_vinyl.png",
    alt: "바이닐 레코드를 소중히 든 멍플리",
    badge: "숨은 명곡 발굴 💿",
  },
  {
    src: "/assets/dogs/dog_jumping.png",
    alt: "신나게 리듬을 타는 멍플리",
    badge: "리듬 타는 중 🐾",
  },
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  query,
  count,
  startTime,
  isDone = false,
  onCancel,
}) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const [poseIndex, setPoseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState(12);

  // Accurate real elapsed time ticker & smooth estimated progress (Sections 5 & 6)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsedMs = Math.max(0, now - startTime);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      setElapsedSeconds(elapsedSec);

      if (isDone) {
        setProgress(100);
      } else {
        // Smooth asymptotic curve approaching max 95% without ever faking 100%
        const t = elapsedMs / 1000;
        const estimated = Math.min(95, Math.floor(10 + 85 * (1 - Math.exp(-t / 3.8))));
        setProgress(estimated);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, isDone]);

  // Smooth message and pose rotation
  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2400);

    const poseTimer = setInterval(() => {
      setPoseIndex((prev) => (prev + 1) % SEARCHING_DOG_POSES.length);
    }, 1500);

    return () => {
      clearInterval(msgTimer);
      clearInterval(poseTimer);
    };
  }, []);

  const currentPose = SEARCHING_DOG_POSES[poseIndex];

  return (
    <div className="w-full max-w-2xl mx-auto py-8 sm:py-14 text-center">
      <div className="bg-white rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_#1c1917] p-6 sm:p-10 relative overflow-hidden">
        {/* Floating animated musical doodle notes and stars (Only in loading screen per rule 4) */}
        <div className="absolute top-5 left-8 text-2xl font-mono text-amber-500 animate-note-1 select-none pointer-events-none">
          ♪
        </div>
        <div className="absolute top-10 right-10 text-3xl font-mono text-amber-600 animate-note-2 select-none pointer-events-none">
          ♫
        </div>
        <div className="absolute top-28 left-6 text-xl text-amber-400 animate-star select-none pointer-events-none">
          ★
        </div>
        <div className="absolute bottom-8 right-8 text-xl font-mono text-stone-700 animate-note-1 select-none pointer-events-none">
          ♩
        </div>
        <div className="absolute bottom-16 left-10 text-lg text-amber-500 animate-star select-none pointer-events-none">
          ✦
        </div>

        {/* Searching Retriever Character Container with Bounce & Rhythm Animation (Section 4) */}
        <div className="mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-amber-50/90 border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] p-4 flex items-center justify-center relative mb-5 overflow-hidden">
          {/* Animated Dog Pose Image */}
          <div className="w-full h-full flex items-center justify-center animate-doodle-bounce">
            <img
              key={currentPose.src}
              src={currentPose.src}
              alt={currentPose.alt}
              className="max-w-full max-h-full object-contain select-none transition-opacity duration-300 animate-doodle-rhythm"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Dynamic Action Badge */}
          <div className="absolute -bottom-1 -right-1 bg-stone-900 text-amber-300 px-3 py-1 rounded-xl text-xs font-bold border border-amber-300 shadow-[2px_2px_0px_#f59e0b] whitespace-nowrap">
            {currentPose.badge}
          </div>
        </div>

        {/* Rotating Status Messages (Section 8) */}
        <div className="max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-stone-900 border border-stone-900/40 rounded-full text-xs font-bold mb-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
            <span>음악 추천 진행 중…</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight transition-opacity duration-300 min-h-[3.25rem] flex items-center justify-center text-balance">
            {LOADING_MESSAGES[msgIndex]}
          </h2>

          {/* Progress Bar & Elapsed Time Container (Sections 5 & 6) */}
          <div className="my-5 p-4 bg-amber-50/70 border-2 border-stone-900 rounded-2xl shadow-[3px_3px_0px_#1c1917] text-left">
            {/* Header row with % and elapsed time */}
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>추천 진행률:</span>
                <span className="font-mono text-sm text-stone-950">
                  {progress}% {progress < 100 && <span className="text-[11px] font-medium text-stone-500">(예상)</span>}
                </span>
              </span>

              <span className="text-stone-700 flex items-center gap-1.5 font-mono text-xs bg-white px-2.5 py-0.5 rounded-lg border border-stone-300">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>경과시간: <strong className="text-stone-900">{elapsedSeconds}초</strong></span>
              </span>
            </div>

            {/* Doodle Style Yellow Progress Bar */}
            <div className="w-full h-4 bg-white border-2 border-stone-900 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 border border-stone-900/30 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] text-stone-500 text-center font-medium">
              {progress < 95
                ? '원하시는 분위기에 가장 잘 맞는 트랙을 선곡하는 중입니다'
                : '거의 다 되었습니다! 곧 결과가 표시됩니다 🐾'}
            </p>
          </div>

          {/* Music Equalizer Display (Section 4) */}
          <div className="my-4 flex flex-col items-center justify-center gap-1.5">
            {/* Doodle Equalizer Image */}
            <div className="w-56 h-8 overflow-hidden flex items-center justify-center opacity-90">
              <img
                src="/assets/dogs/doodle_equalizer.png"
                alt="멍플리 낙서 이퀄라이저"
                className="max-h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Live Audio Equalizer Wave Bars */}
            <div className="flex items-center justify-center gap-1.5 h-6">
              <span className="w-1.5 h-3.5 bg-stone-900 rounded-full animate-bounce [animation-delay:0ms]"></span>
              <span className="w-1.5 h-6 bg-amber-500 rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-1.5 h-4 bg-stone-900 rounded-full animate-bounce [animation-delay:300ms]"></span>
              <span className="w-1.5 h-7 bg-amber-400 rounded-full animate-bounce [animation-delay:200ms]"></span>
              <span className="w-1.5 h-3 bg-stone-900 rounded-full animate-bounce [animation-delay:350ms]"></span>
              <span className="w-1.5 h-5 bg-amber-500 rounded-full animate-bounce [animation-delay:100ms]"></span>
              <span className="w-1.5 h-2.5 bg-stone-900 rounded-full animate-bounce [animation-delay:250ms]"></span>
            </div>
          </div>

          <button type="button" onClick={onCancel} className="mb-4 px-5 py-2 rounded-xl border-2 border-stone-900 bg-white font-bold text-stone-900 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900">
            추천 취소
          </button>

          {/* User Request Feedback */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 text-left">
            <span className="font-bold text-stone-800 block mb-0.5">
              선곡 요청 (슬라이더 설정: {count}곡):
            </span>
            <span className="text-stone-700 italic font-medium line-clamp-1">"{query}"</span>
          </div>
        </div>
      </div>
    </div>
  );
};
