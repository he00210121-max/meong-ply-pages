import React from 'react';
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';

interface ErrorScreenProps {
  errorMessage: string;
  onRetry: () => void;
  onReset: () => void;
  query: string;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorMessage,
  onRetry,
  onReset,
  query,
}) => {
  return (
    <div className="w-full max-w-lg mx-auto py-12 text-center">
      <div className="bg-white rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_#1c1917] p-8 sm:p-10">
        <div className="w-28 h-28 rounded-3xl bg-amber-50 border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] p-2 flex items-center justify-center mx-auto mb-6 relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[5px_5px_0px_#1c1917]">
          <img
            src="/assets/dogs/dog_curious_tilt.png"
            alt="고개를 갸웃하는 멍플리"
            className="w-full h-full object-contain select-none transition-transform duration-200 ease-out group-hover:rotate-6 group-hover:scale-105"
          />
          <div className="absolute top-1 right-2 text-stone-900 font-black text-sm select-none transition-transform duration-200 group-hover:scale-125">
            ?
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-stone-900 mb-2">
          선곡 중 잠시 오류가 발생했어요!
        </h2>

        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          {errorMessage || "멍플리가 음악을 찾는 과정에서 네트워크가 지연되었거나 답변이 지연되었습니다. 다시 한 번 버튼을 눌러 시도해 주세요."}
        </p>

        {query && (
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 text-left mb-6">
            <span className="font-bold text-stone-700 block mb-1">시도했던 요청:</span>
            <span className="italic">"{query}"</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>다시 시도하기</span>
          </button>

          <button
            onClick={onReset}
            className="w-full sm:w-auto px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl border border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:scale-[1.03] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>처음으로 돌아가기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
