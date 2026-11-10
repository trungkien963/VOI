-- ============================================================================
-- 0003_triggers_audit_and_balances.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_set_server_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'accounts', 'account_members', 'pockets',
    'credit_card_details', 'categories', 'tags', 'debts',
    'recurring_rules', 'transactions', 'transaction_lines',
    'exchange_rates', 'onboarding_checklist', 'activity_days', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_server_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_server_updated_at();',
      tbl
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_auto_insert_account_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (account_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_accounts_auto_owner
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_insert_account_owner();

CREATE OR REPLACE FUNCTION public.tg_sync_transaction_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    UPDATE public.transaction_lines
    SET deleted_at = NEW.deleted_at,
        client_updated_at = NEW.client_updated_at,
        updated_at = clock_timestamp()
    WHERE transaction_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_transactions_sync_soft_delete
AFTER UPDATE OF deleted_at ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_transaction_soft_delete();

CREATE OR REPLACE FUNCTION public.recalculate_pocket_balance(p_pocket_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_minor), 0)
  INTO v_balance
  FROM public.transaction_lines
  WHERE pocket_id = p_pocket_id
    AND deleted_at IS NULL;

  UPDATE public.pockets
  SET cached_balance_minor = v_balance,
      updated_at = clock_timestamp()
  WHERE id = p_pocket_id;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_update_pocket_cached_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_pocket_balance(NEW.pocket_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.pocket_id IS DISTINCT FROM NEW.pocket_id THEN
      PERFORM public.recalculate_pocket_balance(OLD.pocket_id);
    END IF;
    PERFORM public.recalculate_pocket_balance(NEW.pocket_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_pocket_balance(OLD.pocket_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_transaction_lines_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_lines
FOR EACH ROW
EXECUTE FUNCTION public.tg_update_pocket_cached_balance();

CREATE OR REPLACE FUNCTION public.tg_record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action_type;
  v_row_id UUID;
  v_before JSONB := NULL;
  v_after JSONB := NULL;
  v_actor UUID;
BEGIN
  v_actor := COALESCE(auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END);

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_row_id := NEW.id;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_row_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_row_id := OLD.id;
    v_before := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (table_name, row_id, action, before_state, after_state, actor_user_id, occurred_at)
  VALUES (TG_TABLE_NAME, v_row_id, v_action, v_before, v_after, v_actor, clock_timestamp());

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  audited_tbl TEXT;
BEGIN
  FOREACH audited_tbl IN ARRAY ARRAY['accounts', 'debts', 'transactions', 'transaction_lines']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_record_audit_log();',
      audited_tbl, audited_tbl
    );
  END LOOP;
END;
$$;

