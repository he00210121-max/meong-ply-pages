export const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
export const BACKUP_MODEL = 'gemini-3.1-flash-lite';
export type Phase = 'initial' | 'continuation' | 'retry';
export type Outcome = 'success' | 'error' | 'cancelled' | 'timeout' | 'not_sent';
export interface UsageStore {
  reserve(id: string, phase: Phase): Promise<string>;
  finish(id: string, outcome: Outcome, errorCode: string | null, dailyQuota: boolean): Promise<void>;
  status(): Promise<unknown>;
  reset(): Promise<void>;
}

export class UsageUnavailable extends Error {
  constructor() { super('Gemini 사용량 기록에 연결할 수 없어 추천을 잠시 중단했어요. 관리자에게 문의해 주세요.'); }
}

async function rpc(name: string, body: object): Promise<any> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new UsageUnavailable();
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Usage RPC failed');
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch { throw new UsageUnavailable(); }
}

export const usageStore: UsageStore = {
  async reserve(id, phase) {
    const rows = await rpc('meong_gemini_reserve', { p_id: id, p_phase: phase });
    const model = rows?.[0]?.model;
    if (model !== PRIMARY_MODEL && model !== BACKUP_MODEL) throw new UsageUnavailable();
    return model;
  },
  async finish(id, outcome, errorCode, dailyQuota) {
    await rpc('meong_gemini_finish', { p_id: id, p_outcome: outcome, p_error_code: errorCode, p_daily_quota: dailyQuota });
  },
  status: () => rpc('meong_gemini_status', {}),
  async reset() { await rpc('meong_gemini_reset', {}); },
};

// Only an explicit per-day request quota signal justifies a persistent switch.
export function isDailyRequestQuota(error: unknown): boolean {
  if (Number((error as any)?.status ?? (error as any)?.code) !== 429) return false;
  let text = '';
  try { text = `${String((error as any)?.message ?? '')} ${JSON.stringify(error)}`; } catch { return false; }
  return /Generate(?:Content)?RequestsPerDayPerProjectPerModel/i.test(text) || /requests[_ ]per[_ ]day/i.test(text);
}
