import React from 'react';

export const TUTORIAL_KEY = 'meongply-tutorial-completed';
const steps = [
  ['intro', '안녕, 나는 멍플리!', '원하는 음악을 함께 찾아볼까?'],
  ['query', '어떤 음악을 좋아해?', '듣고 싶은 음악을 적어 줘. 한 글자만 써도 다음으로 갈 수 있어!'],
  ['model', 'AI 친구 고르기', '음악을 추천해 줄 Gemini 또는 Groq를 골라 봐.'],
  ['count', '몇 곡을 들을까?', '슬라이더나 숫자를 눌러 곡 수를 정해. Gemini는 5~30곡, Groq는 5~10곡이야.'],
  ['mood', '분위기 고르기', '차분한 음악이나 신나는 음악처럼 원하는 느낌을 골라 봐.'],
  ['genre', '장르 고르기', '팝, 재즈처럼 좋아하는 음악 종류를 골라 봐.'],
  ['region', '나라와 지역', '어느 나라의 음악을 듣고 싶은지 골라 봐.'],
  ['era', '음악이 나온 때', '옛날 음악부터 최신 음악까지 원하는 시대를 골라 봐.'],
  ['vocal', '목소리와 연주', '노래하는 목소리가 있는 곡이나 연주곡만 고를 수 있어.'],
  ['popularity', '유명한 곡과 숨은 곡', '많이 알려진 곡이나 숨은 명곡을 골라 봐.'],
  ['cover', '원곡과 커버곡', '처음 나온 원곡이나 다른 사람이 다시 부른 커버곡을 골라 봐.'],
  ['ai', 'AI가 만든 음악', '체크하면 AI가 만든 음악도 추천에 포함할 수 있어.'],
  ['exclude', '빼고 싶은 음악', '듣고 싶지 않은 가수나 음악 종류를 적어 줘.'],
  ['submit', '추천 시작!', '준비가 끝나면 이 버튼을 눌러 음악을 추천받아. 지금은 누르지 않아도 돼!'],
  [null, '추천 결과를 살펴봐', '추천된 곡 이름이나 YouTube 검색 버튼을 누르면 유튜브 검색 결과가 열려. 지금은 예시 안내라 음악을 요청하지 않아.'],
] as const;

type Box = { top: number; left: number; right: number; bottom: number };
export function Tutorial({ step, onStep, onFinish }: { step: number; onStep: (step: number) => void; onFinish: () => void }) {
  const [box, setBox] = React.useState<Box | null>(null);
  const [bubble, setBubble] = React.useState<React.CSSProperties>({});
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const current = steps[step];
  const advance = () => step === steps.length - 1 ? onFinish() : onStep(step + 1);

  React.useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    return () => previousFocus.current?.focus();
  }, []);
  React.useEffect(() => {
    const target = current[0] ? document.querySelector<HTMLElement>(`[data-tutorial="${current[0]}"]`) : null;
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const update = () => {
      if (!target) { setBox(null); setBubble({}); return; }
      const r = target.getBoundingClientRect();
      const b = { top: Math.max(0, r.top - 5), left: Math.max(0, r.left - 5), right: Math.min(innerWidth, r.right + 5), bottom: Math.min(innerHeight, r.bottom + 5) };
      setBox(b);
      const height = dialogRef.current?.offsetHeight || 190;
      const below = innerHeight - b.bottom;
      const top = below >= height + 12 ? b.bottom + 10 : b.top >= height + 12 ? b.top - height - 10 : Math.max(8, innerHeight - height - 12);
      setBubble({ top, left: Math.max(8, Math.min(b.left, innerWidth - Math.min(360, innerWidth - 16) - 8)) });
    };
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = new ResizeObserver(update);
    if (target) observer.observe(target);
    if (dialogRef.current) observer.observe(dialogRef.current);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); observer.disconnect(); };
  }, [step, current]);
  React.useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onFinish(); }
      if (event.key === 'Tab') {
        const allowed = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []);
        const input = step === 1 ? document.querySelector<HTMLElement>('[data-tutorial="query"]') : null;
        if (input) allowed.unshift(input);
        if (!allowed.length) return;
        const index = allowed.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); allowed[allowed.length - 1].focus(); }
        else if (!event.shiftKey && (index === -1 || index === allowed.length - 1)) { event.preventDefault(); allowed[0].focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [step, onFinish]);

  const panel = (style: React.CSSProperties) => <div className="tutorial-shade" style={style} onClick={advance} aria-hidden="true" />;
  return <div className="tutorial-layer">
    {box ? <>
      {panel({ top: 0, left: 0, right: 0, height: box.top })}
      {panel({ top: box.top, left: 0, width: box.left, height: Math.max(0, box.bottom - box.top) })}
      {panel({ top: box.top, left: box.right, right: 0, height: Math.max(0, box.bottom - box.top) })}
      {panel({ top: box.bottom, left: 0, right: 0, bottom: 0 })}
      <div className="tutorial-outline" style={{ top: box.top, left: box.left, width: box.right - box.left, height: Math.max(0, box.bottom - box.top) }} />
      {step !== 1 && <div className="tutorial-target-cover" style={{ top: box.top, left: box.left, width: box.right - box.left, height: Math.max(0, box.bottom - box.top) }} onClick={advance} aria-hidden="true" />}
    </> : panel({ inset: 0 })}
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" className={`tutorial-bubble ${!box ? 'tutorial-centered' : ''}`} style={bubble}>
      <div className="tutorial-heading"><img src="/assets/dogs/dog_sitting_front.png" alt="" /><div><span className="tutorial-number">{step + 1} / {steps.length}</span><h2 id="tutorial-title">{current[1]}</h2></div></div>
      <p id="tutorial-description">{current[2]}</p>
      <p className="tutorial-hint">어두운 곳을 누르면 다음으로 넘어가요.</p>
      <div className="tutorial-actions"><button type="button" onClick={onFinish}>건너뛰기</button><span /><button type="button" disabled={step === 0} onClick={() => onStep(step - 1)}>이전</button><button type="button" className="tutorial-next" onClick={advance}>{step === steps.length - 1 ? '완료' : '다음'}</button></div>
    </div>
  </div>;
}
