import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');

describe('Supabase SQL Migrations & RLS Policies (M0)', () => {
  const coreTablesSql = readFileSync(
    resolve(MIGRATIONS_DIR, '0002_core_tables_and_indexes.sql'),
    'utf-8',
  );
  const rlsSql = readFileSync(resolve(MIGRATIONS_DIR, '0004_rls_policies.sql'), 'utf-8');
  const rpcsSql = readFileSync(resolve(MIGRATIONS_DIR, '0005_atomic_rpcs.sql'), 'utf-8');

  const expectedRlsTables = [
    'profiles',
    'accounts',
    'account_members',
    'pockets',
    'credit_card_details',
    'categories',
    'tags',
    'debts',
    'recurring_rules',
    'transactions',
    'transaction_lines',
    'transaction_tags',
    'exchange_rates',
    'onboarding_checklist',
    'activity_days',
    'push_subscriptions',
    'audit_log',
  ];

  it('enables Row-Level Security (RLS) on all 17 core tables', () => {
    for (const table of expectedRlsTables) {
      expect(rlsSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('enforces ON DELETE RESTRICT on financial ledger lines to prevent accidental data loss', () => {
    expect(coreTablesSql).toContain('ON DELETE RESTRICT');
    expect(coreTablesSql).toContain('cached_balance_minor BIGINT NOT NULL DEFAULT 0');
  });

  it('defines atomic upsert_transaction_bundle and delete_user_account_permanently RPCs', () => {
    expect(rpcsSql).toContain('CREATE OR REPLACE FUNCTION public.upsert_transaction_bundle');
    expect(rpcsSql).toContain('CREATE OR REPLACE FUNCTION public.delete_user_account_permanently');
  });
});
