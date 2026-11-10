import type { OnboardingChecklistState } from '../../domain/types/entities';
import { localDb, type FnAppLocalDB } from '../dexie-schema';

export type ChecklistStepKey =
  | 'created_main_account'
  | 'added_second_account_or_NA'
  | 'added_credit_card_or_NA'
  | 'logged_first_3_expenses'
  | 'added_income_or_recurring_or_NA'
  | 'created_first_budget_or_goal'
  | 'tried_3_second_quick_add';

const ALL_STEP_KEYS: ReadonlyArray<ChecklistStepKey> = [
  'created_main_account',
  'added_second_account_or_NA',
  'added_credit_card_or_NA',
  'logged_first_3_expenses',
  'added_income_or_recurring_or_NA',
  'created_first_budget_or_goal',
  'tried_3_second_quick_add',
];

export function createDefaultChecklistState(userId = 'local-user'): OnboardingChecklistState {
  const nowIso = new Date().toISOString();
  return {
    user_id: userId,
    created_main_account: true,
    added_second_account_or_NA: false,
    added_credit_card_or_NA: false,
    logged_first_3_expenses: false,
    added_income_or_recurring_or_NA: false,
    created_first_budget_or_goal: false,
    tried_3_second_quick_add: false,
    dismissed_at: null,
    completed_at: null,
    updated_at: nowIso,
  };
}

export class OnboardingRepository {
  private readonly db: FnAppLocalDB;

  constructor(db: FnAppLocalDB = localDb) {
    this.db = db;
  }

  /**
   * Read-only getter safe to call inside `useLiveQuery` (never writes inside a live query).
   */
  public async getStateReadOnly(userId = 'local-user'): Promise<OnboardingChecklistState> {
    const existing = await this.db.onboarding_checklist_state.get(userId);
    return existing ?? createDefaultChecklistState(userId);
  }

  public async getOrInitState(userId = 'local-user'): Promise<OnboardingChecklistState> {
    const existing = await this.db.onboarding_checklist_state.get(userId);
    if (existing) return existing;
    const initial = createDefaultChecklistState(userId);
    await this.db.onboarding_checklist_state.put(initial);
    return initial;
  }

  public async markStepCompleted(
    step: ChecklistStepKey,
    userId = 'local-user',
  ): Promise<OnboardingChecklistState> {
    const current = await this.getStateReadOnly(userId);
    const nowIso = new Date().toISOString();
    const next: OnboardingChecklistState = {
      ...current,
      [step]: true,
      updated_at: nowIso,
    };

    const allDone = ALL_STEP_KEYS.every((k) => Boolean(next[k]));
    if (allDone && !next.completed_at) {
      next.completed_at = nowIso;
    }

    await this.db.onboarding_checklist_state.put(next);
    return next;
  }

  public async dismissChecklist(userId = 'local-user'): Promise<OnboardingChecklistState> {
    const current = await this.getStateReadOnly(userId);
    const nowIso = new Date().toISOString();
    const next: OnboardingChecklistState = {
      ...current,
      dismissed_at: nowIso,
      updated_at: nowIso,
    };
    await this.db.onboarding_checklist_state.put(next);
    return next;
  }
}

export const onboardingRepository = new OnboardingRepository();
