import React from 'react';
import { Music, Sparkles } from 'lucide-react';

interface HeaderProps {
  onGoHome: () => void;
  onOpenInfo: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onGoHome, onOpenInfo }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#faf8f5]/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-200 border-2 border-stone-900 flex items-center justify-center p-1 shadow-[2px_2px_0px_#1c1917] group-hover:rotate-6 transition-transform overflow-hidden shrink-0">
            <img
              src="/assets/dogs/dog_sitting_front.png"
              alt="멍플리 마스코트"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-stone-900">
                멍플리
              </span>
              <span className="text-xs font-semibold text-amber-700 font-mono tracking-wider">
                Meong-Ply
              </span>
            </div>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            onClick={onGoHome}
            className="hover:text-stone-950 transition-colors hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            플레이리스트 추천
          </button>
          <a
            href="#examples"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('popular-examples')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-stone-950 transition-colors hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            추천 테마 모음
          </a>
          <button
            onClick={onOpenInfo}
            className="hover:text-stone-950 transition-colors hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            멍플리 소개
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onGoHome}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-stone-900 bg-amber-300 hover:bg-amber-400 border border-stone-900 rounded-lg shadow-[2px_2px_0px_#1c1917] hover:shadow-[1px_1px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Music className="w-3.5 h-3.5" />
            <span>음악 찾기</span>
          </button>
        </div>
      </div>
    </header>
  );
};
