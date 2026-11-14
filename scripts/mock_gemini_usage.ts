import { BACKUP_MODEL, PRIMARY_MODEL, type UsageStore, type Outcome, type Phase } from '../src/server/geminiUsage.ts';

// Shared state simulates a durable database across application instances, not PostgreSQL locking.
export class MockUsage implements UsageStore {
  model = PRIMARY_MODEL;
  calls = new Map<string, { model: string; phase: Phase; outcome: string }>();
  primaryToday = 0;
  fail = false;
  async reserve(id: string, phase: Phase) {
    if (this.fail) throw new Error('database unavailable');
    if (this.model === PRIMARY_MODEL && this.primaryToday >= 500) this.model = BACKUP_MODEL;
    const model = this.model;
    if (model === PRIMARY_MODEL) this.primaryToday++;
    this.calls.set(id, { model, phase, outcome: 'reserved' });
    return model;
  }
  async finish(id: string, outcome: Outcome, _code: string | null, dailyQuota: boolean) {
    if (this.fail) throw new Error('database unavailable');
    const call = this.calls.get(id);
    if (!call) throw new Error('missing reservation');
    call.outcome = outcome;
    if (dailyQuota && call.model === PRIMARY_MODEL) this.model = BACKUP_MODEL;
  }
  async status() { return { currentModel: this.model, total: this.calls.size }; }
  async reset() { if (this.primaryToday >= 500) throw new Error('limit'); this.model = PRIMARY_MODEL; }
}
