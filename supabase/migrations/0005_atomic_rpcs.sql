-- ============================================================================
-- 0005_atomic_rpcs.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_transaction_bundle(
  p_transaction JSONB,
  p_lines JSONB,
  p_tag_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_tx_type public.transaction_type;
  v_client_updated_at TIMESTAMPTZ;
  v_existing_client_updated_at TIMESTAMPTZ;
  v_deleted_at TIMESTAMPTZ;
  v_line JSONB;
  v_line_count INT;
  v_neg_count INT := 0;
  v_pos_count INT := 0;
  v_amt BIGINT;
  v_tag_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  v_tx_id := (p_transaction->>'id')::UUID;
  v_tx_type := (p_transaction->>'type')::public.transaction_type;
  v_client_updated_at := COALESCE((p_transaction->>'client_updated_at')::TIMESTAMPTZ, NOW());
  v_deleted_at := (p_transaction->>'deleted_at')::TIMESTAMPTZ;

  SELECT client_updated_at INTO v_existing_client_updated_at
  FROM public.transactions
  WHERE id = v_tx_id;

  IF v_existing_client_updated_at IS NOT NULL AND v_existing_client_updated_at > v_client_updated_at THEN
    RETURN jsonb_build_object(
      'status', 'skipped_stale',
      'transaction_id', v_tx_id,
      'server_client_updated_at', v_existing_client_updated_at
    );
  END IF;

  v_line_count := jsonb_array_length(p_lines);
  IF v_deleted_at IS NULL THEN
    IF v_tx_type = 'transfer' AND v_line_count <> 2 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: transfer must have exactly 2 lines';
    ELSIF v_tx_type <> 'transfer' AND v_line_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % must have exactly 1 line', v_tx_type;
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_amt := (v_line->>'amount_minor')::BIGINT;
      IF v_amt < 0 THEN v_neg_count := v_neg_count + 1; END IF;
      IF v_amt > 0 THEN v_pos_count := v_pos_count + 1; END IF;
    END LOOP;

    IF v_tx_type IN ('expense', 'lend', 'debt_repay') AND v_neg_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % line must be negative', v_tx_type;
    ELSIF v_tx_type IN ('income', 'borrow', 'debt_collect') AND v_pos_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % line must be positive', v_tx_type;
    ELSIF v_tx_type = 'transfer' AND (v_neg_count <> 1 OR v_pos_count <> 1) THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: transfer must have 1 negative line and 1 positive line';
    END IF;
  END IF;

  INSERT INTO public.transactions (
    id, type, occurred_at, category_id, note, source,
    group_id, recurring_rule_id, debt_id, created_by,
    client_updated_at, deleted_at
  )
  VALUES (
    v_tx_id,
    v_tx_type,
    COALESCE((p_transaction->>'occurred_at')::TIMESTAMPTZ, NOW()),
    NULLIF(p_transaction->>'category_id', '')::UUID,
    p_transaction->>'note',
    COALESCE((p_transaction->>'source')::public.transaction_source, 'quick_input'),
    NULLIF(p_transaction->>'group_id', '')::UUID,
    NULLIF(p_transaction->>'recurring_rule_id', '')::UUID,
    NULLIF(p_transaction->>'debt_id', '')::UUID,
    auth.uid(),
    v_client_updated_at,
    v_deleted_at
  )
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    occurred_at = EXCLUDED.occurred_at,
    category_id = EXCLUDED.category_id,
    note = EXCLUDED.note,
    source = EXCLUDED.source,
    group_id = EXCLUDED.group_id,
    recurring_rule_id = EXCLUDED.recurring_rule_id,
    debt_id = EXCLUDED.debt_id,
    client_updated_at = EXCLUDED.client_updated_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = clock_timestamp();

  UPDATE public.transaction_lines
  SET deleted_at = COALESCE(v_deleted_at, clock_timestamp()),
      client_updated_at = v_client_updated_at,
      updated_at = clock_timestamp()
  WHERE transaction_id = v_tx_id
    AND id NOT IN (
      SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_lines) AS elem
    );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.transaction_lines (
      id, transaction_id, account_id, pocket_id,
      amount_minor, currency, fx_rate_to_base, amount_base_minor,
      created_by, client_updated_at, deleted_at
    )
    VALUES (
      (v_line->>'id')::UUID,
      v_tx_id,
      (v_line->>'account_id')::UUID,
      (v_line->>'pocket_id')::UUID,
      (v_line->>'amount_minor')::BIGINT,
      COALESCE(v_line->>'currency', 'VND'),
      COALESCE((v_line->>'fx_rate_to_base')::NUMERIC, 1.0),
      (v_line->>'amount_base_minor')::BIGINT,
      auth.uid(),
      v_client_updated_at,
      COALESCE(v_deleted_at, (v_line->>'deleted_at')::TIMESTAMPTZ)
    )
    ON CONFLICT (id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      pocket_id = EXCLUDED.pocket_id,
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency,
      fx_rate_to_base = EXCLUDED.fx_rate_to_base,
      amount_base_minor = EXCLUDED.amount_base_minor,
      client_updated_at = EXCLUDED.client_updated_at,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = clock_timestamp();
  END LOOP;

  DELETE FROM public.transaction_tags WHERE transaction_id = v_tx_id;
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
      INSERT INTO public.transaction_tags (transaction_id, tag_id)
      VALUES (v_tx_id, v_tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', 'synced',
    'transaction_id', v_tx_id,
    'server_updated_at', clock_timestamp()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account_permanently()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  DELETE FROM public.transaction_tags WHERE transaction_id IN (SELECT id FROM public.transactions WHERE created_by = v_uid);
  DELETE FROM public.transaction_lines WHERE created_by = v_uid;
  DELETE FROM public.transactions WHERE created_by = v_uid;
  DELETE FROM public.recurring_rules WHERE owner_user_id = v_uid;
  DELETE FROM public.debts WHERE owner_user_id = v_uid;
  DELETE FROM public.credit_card_details WHERE account_id IN (SELECT id FROM public.accounts WHERE created_by = v_uid);
  DELETE FROM public.pockets WHERE created_by = v_uid;
  DELETE FROM public.account_members WHERE user_id = v_uid;
  DELETE FROM public.accounts WHERE created_by = v_uid;
  DELETE FROM public.tags WHERE owner_user_id = v_uid;
  DELETE FROM public.categories WHERE owner_user_id = v_uid;
  DELETE FROM public.onboarding_checklist WHERE user_id = v_uid;
  DELETE FROM public.activity_days WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid;
  DELETE FROM public.audit_log WHERE actor_user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;

  RETURN TRUE;
END;
$$;

