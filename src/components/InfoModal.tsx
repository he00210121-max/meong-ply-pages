import React from 'react';
import { X, CheckCircle2, ShieldCheck, Sparkles, Youtube } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTutorial: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, onTutorial }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_#1c1917] max-w-lg w-full p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center border border-stone-300 font-bold"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-200 border-2 border-stone-900 flex items-center justify-center p-1 shadow-[2px_2px_0px_#1c1917] overflow-hidden shrink-0">
            <img
              src="/assets/dogs/dog_sitting_front.png"
              alt="멍플리 캐릭터"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="text-lg font-black text-stone-900">멍플리 (Meong-Ply)</h3>
            <p className="text-xs text-stone-500 font-medium">
              AI 유튜브 플레이리스트 큐레이터
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs sm:text-sm text-stone-700 leading-relaxed">
          <p>
            <strong>멍플리</strong>는 원하는 음악을 찾기 어려워하는 학생이나 유튜브 이용자를 위해 탄생한 음악 추천 웹앱입니다.
          </p>

          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span><strong>무회원가입 간편 이용:</strong> 별도의 로그인이나 가입 없이 즉시 추천받을 수 있습니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span><strong>분위기·장르·곡 수 정밀 분석:</strong> 자연스러운 한국어 문장으로 원하는 감성을 입력하면 AI가 맞춤 곡을 선곡합니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span><strong>원클릭 유튜브 검색 연동:</strong> 추천된 곡명과 가수로 유튜브 공식 검색창에 곧바로 연결됩니다.</span>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-600 text-xs">
            <span className="font-bold text-stone-800 block mb-1">안전 및 투명성 안내</span>
            멍플리는 확인되지 않은 가짜 링크를 생성하지 않으며, 안전한 유튜브 공식 검색 쿼리를 통해 실제 음원을 찾을 수 있도록 돕습니다.
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-stone-200 flex flex-wrap justify-end gap-3">
          <button onClick={onTutorial} className="px-5 py-2 bg-white hover:bg-amber-50 text-stone-900 font-extrabold text-xs rounded-xl border border-stone-900 cursor-pointer">???? ?? ??</button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold text-xs rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] transition-all cursor-pointer"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
};
