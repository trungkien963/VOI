import Dexie, { type Table } from 'dexie';
import { DEFAULT_SYSTEM_CATEGORIES } from '../domain/categories/default-categories';
import type {
  Account,
  AuditEvent,
  Budget,
  Category,
  Counterparty,
  CreditCardStatement,
  DebtItem,
  DebtSettlement,
  MerchantAlias,
  OnboardingChecklistState,
  Pocket,
  Profile,
  RecurringRule,
  SyncCursor,
  SyncOutboxItem,
  Tag,
  Transaction,
  TransactionLine,
  TransactionTag,
} from '../domain/types/entities';

export class FnAppLocalDB extends Dexie {
  profiles!: Table<Profile, string>;
  onboarding_checklist_state!: Table<OnboardingChecklistState, string>;
  accounts!: Table<Account, string>;
  pockets!: Table<Pocket, string>;
  categories!: Table<Category, string>;
  tags!: Table<Tag, string>;
  counterparties!: Table<Counterparty, string>;
  transactions!: Table<Transaction, string>;
  transaction_lines!: Table<TransactionLine, string>;
  transaction_tags!: Table<TransactionTag, [string, string]>;
  credit_card_statements!: Table<CreditCardStatement, string>;
  debt_items!: Table<DebtItem, string>;
  debt_settlements!: Table<DebtSettlement, string>;
  budgets!: Table<Budget, string>;
  recurring_rules!: Table<RecurringRule, string>;
  merchant_aliases!: Table<MerchantAlias, string>;
  audit_events!: Table<AuditEvent, string>;
  sync_outbox!: Table<SyncOutboxItem, number>;
  sync_cursors!: Table<SyncCursor, string>;

  constructor(dbName = 'fn_app_local_v2') {
    super(dbName);

    this.version(1).stores({
      profiles: 'user_id, updated_at',
      onboarding_checklist_state: 'user_id, updated_at',
      accounts: 'id, user_id, type, is_default_spend, archived_at, sort_order, updated_at',
      pockets: 'id, user_id, account_id, type, is_default, archived_at, updated_at',
      categories: 'id, user_id, parent_id, kind, slug, is_system, sort_order, updated_at',
      tags: 'id, user_id, name',
      counterparties: 'id, user_id, name, archived_at, updated_at',
      transactions:
        'id, &client_id, user_id, [user_id+status+txn_date], txn_date, occurred_at, type, status, category_id, counterparty_id, debt_id, group_id, recurring_rule_id, updated_at',
      transaction_lines:
        'id, transaction_id, account_id, pocket_id, [account_id+created_at], [pocket_id+created_at]',
      transaction_tags: '[transaction_id+tag_id], transaction_id, tag_id, user_id',
      credit_card_statements: 'id, account_id, status, due_date, [account_id+period_end]',
      debt_items: 'id, counterparty_id, direction, status, due_date, updated_at',
      debt_settlements: 'id, debt_item_id, transaction_id, settled_date',
      budgets: 'id, [user_id+month_key], month_key, category_id, updated_at',
      recurring_rules: 'id, is_active, next_run_date, account_id, updated_at',
      merchant_aliases: 'id, &[user_id+pattern_normalized], pattern_normalized, hit_count',
      audit_events: 'id, [entity_table+entity_id], created_at',
      sync_outbox:
        '++seq, &client_mutation_id, entity_table, operation, created_at, retry_count, status',
      sync_cursors: 'table_name, last_synced_updated_at',
    });
  }
}

export const localDb = new FnAppLocalDB();

export const DEFAULT_STARTER_ACCOUNTS: Account[] = [
  {
    id: 'acc-default-bank',
    user_id: 'local-user',
    name: 'Main Bank (VCB)',
    type: 'bank',
    currency: 'VND',
    institution_name: 'VCB',
    color_hex: '#3B82F6',
    icon_name: 'hexagon',
    include_in_net_worth: true,
    is_default_spend: true,
    cached_balance_minor: 0,
    credit_limit_minor: null,
    statement_day: null,
    payment_due_day: null,
    grace_period_days: null,
    apr_bps: null,
    sort_order: 10,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-default-cash',
    user_id: 'local-user',
    name: 'Cash Wallet',
    type: 'cash',
    currency: 'VND',
    institution_name: null,
    color_hex: '#FFB703',
    icon_name: 'arch',
    include_in_net_worth: true,
    is_default_spend: false,
    cached_balance_minor: 0,
    credit_limit_minor: null,
    statement_day: null,
    payment_due_day: null,
    grace_period_days: null,
    apr_bps: null,
    sort_order: 20,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-default-momo',
    user_id: 'local-user',
    name: 'MoMo Wallet',
    type: 'e_wallet',
    currency: 'VND',
    institution_name: 'MoMo',
    color_hex: '#F472B6',
    icon_name: 'pentagon',
    include_in_net_worth: true,
    is_default_spend: false,
    cached_balance_minor: 0,
    credit_limit_minor: null,
    statement_day: null,
    payment_due_day: null,
    grace_period_days: null,
    apr_bps: null,
    sort_order: 30,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_STARTER_POCKETS: Pocket[] = [
  {
    id: 'pocket-acc-default-bank-vnd',
    user_id: 'local-user',
    account_id: 'acc-default-bank',
    name: 'Main Bank (VCB) (VND)',
    currency: 'VND',
    type: 'spendable',
    target_amount_minor: null,
    target_date: null,
    cached_balance_minor: 0,
    color_hex: '#3B82F6',
    icon_name: 'hexagon',
    is_default: true,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pocket-acc-default-cash-vnd',
    user_id: 'local-user',
    account_id: 'acc-default-cash',
    name: 'Cash Wallet (VND)',
    currency: 'VND',
    type: 'spendable',
    target_amount_minor: null,
    target_date: null,
    cached_balance_minor: 0,
    color_hex: '#FFB703',
    icon_name: 'arch',
    is_default: true,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pocket-acc-default-momo-vnd',
    user_id: 'local-user',
    account_id: 'acc-default-momo',
    name: 'MoMo Wallet (VND)',
    currency: 'VND',
    type: 'spendable',
    target_amount_minor: null,
    target_date: null,
    cached_balance_minor: 0,
    color_hex: '#F472B6',
    icon_name: 'pentagon',
    is_default: true,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

export async function ensureSeedData(db: FnAppLocalDB = localDb): Promise<void> {
  const existingCount = await db.categories.count();
  if (existingCount === 0) {
    await db.categories.bulkPut(DEFAULT_SYSTEM_CATEGORIES);
  }
  const existingAccounts = await db.accounts.count();
  if (existingAccounts === 0) {
    await db.accounts.bulkPut(DEFAULT_STARTER_ACCOUNTS);
    await db.pockets.bulkPut(DEFAULT_STARTER_POCKETS);
  }

  // Self-healing repair: if any VND transaction_line was accidentally recorded into a non-VND pocket
  // (e.g. Cash Wallet (USD) due to lexicographical ID sorting), move it to the account's VND pocket
  // and recompute cached pocket & account balances accurately.
  const [allPockets, allAccounts, allTxs, allLines] = await Promise.all([
    db.pockets.toArray(),
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.transaction_lines.toArray(),
  ]);

  if (allPockets.length > 0 && allLines.length > 0) {
    const pocketById = new Map(allPockets.map((p) => [p.id, p]));
    const txById = new Map(allTxs.map((tx) => [tx.id, tx]));
    let repairedAnyLine = false;

    for (const line of allLines) {
      if (!line.pocket_id) continue;
      const pocket = pocketById.get(line.pocket_id);
      if (!pocket) continue;
      const parentTx = txById.get(line.transaction_id);
      const lineCurrency = (line.currency ?? parentTx?.currency ?? 'VND').toUpperCase();
      const pocketCurrency = (pocket.currency ?? 'VND').toUpperCase();

      if (lineCurrency !== pocketCurrency) {
        const matchingPocket = allPockets.find(
          (cand) =>
            cand.account_id === pocket.account_id &&
            (cand.currency ?? 'VND').toUpperCase() === lineCurrency &&
            cand.archived_at === null,
        );
        if (matchingPocket) {
          line.pocket_id = matchingPocket.id;
          await db.transaction_lines.update(line.id, { pocket_id: matchingPocket.id });
          repairedAnyLine = true;
        }
      }
    }

    if (repairedAnyLine) {
      const voidTxIds = new Set(
        allTxs.filter((tx) => tx.voided_at !== null || tx.status === 'void').map((tx) => tx.id),
      );
      const nextPocketBalance = new Map<string, number>();
      for (const p of allPockets) {
        nextPocketBalance.set(p.id, 0);
      }
      for (const line of allLines) {
        if (line.deleted_at || voidTxIds.has(line.transaction_id) || !line.pocket_id) continue;
        nextPocketBalance.set(
          line.pocket_id,
          (nextPocketBalance.get(line.pocket_id) ?? 0) + line.signed_amount_minor,
        );
      }
      for (const p of allPockets) {
        const computed = nextPocketBalance.get(p.id) ?? 0;
        if (p.cached_balance_minor !== computed) {
          p.cached_balance_minor = computed;
          await db.pockets.update(p.id, { cached_balance_minor: computed });
        }
      }
      for (const acc of allAccounts) {
        const accVndPockets = allPockets.filter(
          (p) =>
            p.account_id === acc.id &&
            p.archived_at === null &&
            (p.currency ?? 'VND').toUpperCase() === 'VND',
        );
        const accComputed = accVndPockets.reduce((sum, p) => sum + p.cached_balance_minor, 0);
        if (acc.cached_balance_minor !== accComputed) {
          await db.accounts.update(acc.id, { cached_balance_minor: accComputed });
        }
      }
    }
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persist === 'function'
  ) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}
