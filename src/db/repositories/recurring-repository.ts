import type { Table } from 'dexie';
import {
  confirmRecurringRuleOccurrence,
  skipRecurringRuleOccurrence,
} from '../../domain/ledger/recurring-calculator';
import type {
  RecurrenceFrequency,
  RecurringRule,
  TransactionType,
} from '../../domain/types/entities';
import { BaseRepository } from './base-repository';
import { transactionRepository } from './transaction-repository';

export interface CreateRecurringRuleInput {
  id?: string;
  userId?: string;
  title: string;
  templateType?: TransactionType;
  frequency?: RecurrenceFrequency;
  intervalCount?: number;
  dayOfMonth?: number | null;
  nextRunDate: string;
  amountMinor: number;
  accountId: string;
  pocketId: string | null;
  categoryId?: string | null;
  totalOccurrences?: number | null;
  occurrencesDone?: number;
  note?: string | null;
}

export class RecurringRepository extends BaseRepository<RecurringRule> {
  protected readonly tableName = 'recurring_rules';

  protected get table(): Table<RecurringRule, string> {
    return this.db.recurring_rules;
  }

  public async listActiveRules(): Promise<RecurringRule[]> {
    const all = await this.db.recurring_rules.toArray();
    return all.filter((r) => r.is_active);
  }

  public async createRuleAtomic(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    const nowIso = new Date().toISOString();
    const id = input.id ?? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dayFromDate = Number(input.nextRunDate.slice(8, 10)) || 1;

    const rule: RecurringRule = {
      id,
      user_id: input.userId ?? 'local-user',
      title: input.title.trim(),
      template_type: input.templateType ?? 'expense',
      frequency: input.frequency ?? 'monthly',
      interval_count: input.intervalCount ?? 1,
      day_of_month: input.dayOfMonth ?? dayFromDate,
      day_of_week: null,
      next_run_date: input.nextRunDate,
      last_run_date: null,
      auto_post: false,
      remind_days_before: 1,
      amount_minor: Math.abs(Math.trunc(input.amountMinor)),
      account_id: input.accountId,
      to_account_id: null,
      pocket_id: input.pocketId,
      category_id: input.categoryId ?? null,
      counterparty_id: null,
      note: input.note ?? input.title.trim(),
      total_occurrences: input.totalOccurrences ?? null,
      occurrences_done: input.occurrencesDone ?? 0,
      skipped_dates: [],
      require_confirmation: true,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.upsertAtomic(rule);
    return rule;
  }

  /**
   * Section 8.8: Confirms a due recurring rule, creating the ledger transaction ONLY upon confirmation.
   */
  public async confirmDueRuleAtomic(
    ruleId: string,
    actualAmountMinor?: number,
  ): Promise<RecurringRule> {
    const rule = await this.db.recurring_rules.get(ruleId);
    if (!rule) {
      throw new Error(`RecurringRule ${ruleId} not found`);
    }

    const txId = `tx-rec-${rule.id}-${Date.now()}`;
    const { updatedRule, transactionBundle } = confirmRecurringRuleOccurrence({
      rule,
      transactionId: txId,
      actualAmountMinor,
    });

    await transactionRepository.saveBundlesAtomic([transactionBundle]);
    await this.upsertAtomic(updatedRule);
    return updatedRule;
  }

  /**
   * Section 8.8: Skips the current due cycle (`skipped_dates`) without creating any ledger transaction.
   */
  public async skipDueRuleAtomic(ruleId: string): Promise<RecurringRule> {
    const rule = await this.db.recurring_rules.get(ruleId);
    if (!rule) {
      throw new Error(`RecurringRule ${ruleId} not found`);
    }

    const updatedRule = skipRecurringRuleOccurrence(rule);
    await this.upsertAtomic(updatedRule);
    return updatedRule;
  }

  /**
   * Early Payoff / Prepayment for Installments ("Tất toán sớm trả góp"):
   * Settles all remaining installment terms in a single ledger transaction and marks the rule completed.
   */
  public async settleInstallmentEarlyAtomic(
    ruleId: string,
    customSettlementAmountMinor?: number,
  ): Promise<RecurringRule> {
    const rule = await this.db.recurring_rules.get(ruleId);
    if (!rule) {
      throw new Error(`RecurringRule ${ruleId} not found`);
    }

    const totalTerms = rule.total_occurrences ?? 1;
    const doneTerms = rule.occurrences_done ?? 0;
    const remainingTerms = Math.max(1, totalTerms - doneTerms);
    const settlementAmountMinor =
      customSettlementAmountMinor !== undefined
        ? Math.abs(Math.trunc(customSettlementAmountMinor))
        : remainingTerms * Math.abs(rule.amount_minor);

    const nowIso = new Date().toISOString();
    const txId = `tx-rec-early-${rule.id}-${Date.now()}`;
    const { transactionBundle } = confirmRecurringRuleOccurrence({
      rule: {
        ...rule,
        note: `${rule.title} — Early Payoff (${remainingTerms} remaining term(s))`,
      },
      transactionId: txId,
      actualAmountMinor: settlementAmountMinor,
      occurredAt: nowIso,
    });

    const completedRule: RecurringRule = {
      ...rule,
      occurrences_done: totalTerms,
      last_run_date: nowIso.slice(0, 10),
      is_active: false,
      updated_at: nowIso,
    };

    await transactionRepository.saveBundlesAtomic([transactionBundle]);
    await this.upsertAtomic(completedRule);
    return completedRule;
  }

  public async deleteRuleAtomic(ruleId: string): Promise<void> {
    const rule = await this.db.recurring_rules.get(ruleId);
    if (!rule) return;
    await this.upsertAtomic({
      ...rule,
      is_active: false,
      updated_at: new Date().toISOString(),
    });
  }
}

export const recurringRepository = new RecurringRepository();
