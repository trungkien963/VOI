import { type FnAppLocalDB } from '../../db/dexie-schema';
import type {
  Account,
  Category,
  Counterparty,
  DebtItem,
  DebtSettlement,
  Pocket,
  RecurringRule,
  SupportedLocale,
  Tag,
  Transaction,
  TransactionLine,
  TransactionTag,
} from '../types/entities';

/**
 * Section 10: Protects exported CSV files against Formula / CSV Injection in Excel & Google Sheets.
 * Any string starting with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote "'".
 */
export function escapeCsvCell(rawValue: string | number | null | undefined): string {
  if (rawValue === null || rawValue === undefined) return '';
  if (typeof rawValue === 'number') return String(rawValue);

  let str = String(rawValue);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvExportInput {
  transactions: readonly Transaction[];
  lines: readonly TransactionLine[];
  accounts: readonly Account[];
  categories: readonly Category[];
  tags?: readonly Tag[];
  transactionTags?: readonly TransactionTag[];
}

/**
 * Section 10: Exports all active transactions to CSV (date, type, account, currency,
 * amount, base_amount, category, tags, note) with CSV Injection protection.
 */
export function exportTransactionsToCsv(input: CsvExportInput): string {
  const accountMap = new Map(input.accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map(input.categories.map((c) => [c.id, c.name]));
  const tagMap = new Map((input.tags ?? []).map((t) => [t.id, t.name]));

  const txLinesMap = new Map<string, TransactionLine[]>();
  for (const line of input.lines) {
    if (line.deleted_at) continue;
    const list = txLinesMap.get(line.transaction_id) ?? [];
    list.push(line);
    txLinesMap.set(line.transaction_id, list);
  }

  const txTagsMap = new Map<string, string[]>();
  for (const tt of input.transactionTags ?? []) {
    const tagName = tagMap.get(tt.tag_id);
    if (!tagName) continue;
    const list = txTagsMap.get(tt.transaction_id) ?? [];
    list.push(tagName);
    txTagsMap.set(tt.transaction_id, list);
  }

  const header = [
    'date',
    'type',
    'account',
    'currency',
    'amount',
    'base_amount',
    'category',
    'tags',
    'note',
  ].join(',');

  const rows: string[] = [header];
  const activeTxs = input.transactions
    .filter((tx) => tx.status !== 'void' && tx.voided_at === null)
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  for (const tx of activeTxs) {
    const txLines = txLinesMap.get(tx.id) ?? [];
    const primaryLine = txLines[0];
    const accountName = primaryLine ? (accountMap.get(primaryLine.account_id) ?? '') : '';
    const baseAmount =
      primaryLine?.amount_base_minor !== undefined
        ? Math.abs(primaryLine.amount_base_minor)
        : Math.abs(tx.amount_minor);
    const categoryName = tx.category_id ? (categoryMap.get(tx.category_id) ?? '') : '';
    const tagStr = (txTagsMap.get(tx.id) ?? []).join(';');

    rows.push(
      [
        escapeCsvCell(tx.txn_date),
        escapeCsvCell(tx.type),
        escapeCsvCell(accountName),
        escapeCsvCell(tx.currency),
        escapeCsvCell(tx.amount_minor),
        escapeCsvCell(baseAmount),
        escapeCsvCell(categoryName),
        escapeCsvCell(tagStr),
        escapeCsvCell(tx.note ?? ''),
      ].join(','),
    );
  }

  return rows.join('\n');
}

export interface FullDatabaseSnapshot {
  version: 1;
  exportedAt: string;
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  tags: Tag[];
  counterparties: Counterparty[];
  transactions: Transaction[];
  transaction_lines: TransactionLine[];
  transaction_tags: TransactionTag[];
  debt_items: DebtItem[];
  debt_settlements: DebtSettlement[];
  recurring_rules: RecurringRule[];
}

export async function createFullDatabaseSnapshot(
  db: FnAppLocalDB,
): Promise<FullDatabaseSnapshot> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    pockets: await db.pockets.toArray(),
    categories: await db.categories.toArray(),
    tags: await db.tags.toArray(),
    counterparties: await db.counterparties.toArray(),
    transactions: await db.transactions.toArray(),
    transaction_lines: await db.transaction_lines.toArray(),
    transaction_tags: await db.transaction_tags.toArray(),
    debt_items: await db.debt_items.toArray(),
    debt_settlements: await db.debt_settlements.toArray(),
    recurring_rules: await db.recurring_rules.toArray(),
  };
}

export async function restoreFullDatabaseSnapshot(
  db: FnAppLocalDB,
  snapshot: FullDatabaseSnapshot,
): Promise<void> {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.accounts)) {
    throw new Error('Invalid FN-APP snapshot format');
  }

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.pockets,
      db.categories,
      db.tags,
      db.counterparties,
      db.transactions,
      db.transaction_lines,
      db.transaction_tags,
      db.debt_items,
      db.debt_settlements,
      db.recurring_rules,
    ],
    async () => {
      await db.accounts.clear();
      await db.pockets.clear();
      await db.categories.clear();
      await db.tags.clear();
      await db.counterparties.clear();
      await db.transactions.clear();
      await db.transaction_lines.clear();
      await db.transaction_tags.clear();
      await db.debt_items.clear();
      await db.debt_settlements.clear();
      await db.recurring_rules.clear();

      await db.accounts.bulkPut(snapshot.accounts);
      await db.pockets.bulkPut(snapshot.pockets);
      await db.categories.bulkPut(snapshot.categories);
      await db.tags.bulkPut(snapshot.tags);
      await db.counterparties.bulkPut(snapshot.counterparties);
      await db.transactions.bulkPut(snapshot.transactions);
      await db.transaction_lines.bulkPut(snapshot.transaction_lines);
      await db.transaction_tags.bulkPut(snapshot.transaction_tags);
      await db.debt_items.bulkPut(snapshot.debt_items);
      await db.debt_settlements.bulkPut(snapshot.debt_settlements);
      await db.recurring_rules.bulkPut(snapshot.recurring_rules);
    },
  );
}

/**
 * Section 10: Unsynced Outbox Guard before Sign-Out / Account Switch.
 */
export async function evaluateSignOutGuard(
  db: FnAppLocalDB,
  locale: SupportedLocale = 'vi',
): Promise<{ allowed: boolean; unsyncedCount: number; warningMessage: string | null }> {
  const outbox = await db.sync_outbox.toArray();
  const unsyncedCount = outbox.length;
  if (unsyncedCount === 0) {
    return { allowed: true, unsyncedCount: 0, warningMessage: null };
  }

  const warningMessage =
    locale === 'vi'
      ? `Bạn còn ${unsyncedCount} thay đổi chưa được đồng bộ lên đám mây. Hãy kết nối mạng để đồng bộ hoặc tải bản sao lưu trước khi đăng xuất.`
      : `You have ${unsyncedCount} unsynced changes. Please connect to sync or download a JSON backup before signing out.`;

  return { allowed: false, unsyncedCount, warningMessage };
}

/**
 * Section 8.11 & 10: 2-Step Permanent Account & Local Data Deletion (the only exception to soft-delete).
 */
export async function permanentlyDeleteAllUserData(
  db: FnAppLocalDB,
  step1Confirmed: boolean,
  confirmationText: string,
): Promise<{ deleted: boolean }> {
  if (!step1Confirmed || confirmationText.trim().toUpperCase() !== 'DELETE') {
    return { deleted: false };
  }

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });

  return { deleted: true };
}

