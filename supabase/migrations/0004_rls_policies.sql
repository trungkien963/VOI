-- ============================================================================
-- 0004_rls_policies.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_account(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_owner(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
      AND am.role = 'owner'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY accounts_select_member ON public.accounts FOR SELECT USING (public.is_account_member(id));
CREATE POLICY accounts_insert_creator ON public.accounts FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY accounts_update_writer ON public.accounts FOR UPDATE USING (public.can_write_account(id)) WITH CHECK (public.can_write_account(id));
CREATE POLICY accounts_delete_owner ON public.accounts FOR DELETE USING (public.is_account_owner(id));

CREATE POLICY account_members_select ON public.account_members FOR SELECT USING (user_id = auth.uid() OR public.is_account_member(account_id));
CREATE POLICY account_members_insert_owner ON public.account_members FOR INSERT WITH CHECK (public.is_account_owner(account_id));
CREATE POLICY account_members_update_owner ON public.account_members FOR UPDATE USING (public.is_account_owner(account_id)) WITH CHECK (public.is_account_owner(account_id));
CREATE POLICY account_members_delete_owner ON public.account_members FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY pockets_select_member ON public.pockets FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY pockets_insert_writer ON public.pockets FOR INSERT WITH CHECK (created_by = auth.uid() AND public.can_write_account(account_id));
CREATE POLICY pockets_update_writer ON public.pockets FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY pockets_delete_owner ON public.pockets FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY cc_details_select_member ON public.credit_card_details FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY cc_details_insert_writer ON public.credit_card_details FOR INSERT WITH CHECK (public.can_write_account(account_id));
CREATE POLICY cc_details_update_writer ON public.credit_card_details FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY cc_details_delete_owner ON public.credit_card_details FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY categories_select_sys_or_own ON public.categories FOR SELECT USING (owner_user_id IS NULL OR owner_user_id = auth.uid());
CREATE POLICY categories_insert_own ON public.categories FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND is_system_special = FALSE);
CREATE POLICY categories_update_own ON public.categories FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid() AND is_system_special = FALSE);
CREATE POLICY categories_delete_own ON public.categories FOR DELETE USING (owner_user_id = auth.uid() AND is_system_special = FALSE);

CREATE POLICY tags_select_own ON public.tags FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY tags_insert_own ON public.tags FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY tags_update_own ON public.tags FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY tags_delete_own ON public.tags FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY debts_select_own ON public.debts FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY debts_insert_own ON public.debts FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY debts_update_own ON public.debts FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY debts_delete_own ON public.debts FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY recurring_select_own ON public.recurring_rules FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY recurring_insert_own ON public.recurring_rules FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY recurring_update_own ON public.recurring_rules FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY recurring_delete_own ON public.recurring_rules FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY transactions_select_access ON public.transactions FOR SELECT USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.transaction_lines tl WHERE tl.transaction_id = public.transactions.id AND public.is_account_member(tl.account_id)
  )
);
CREATE POLICY transactions_insert_own ON public.transactions FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY transactions_update_access ON public.transactions FOR UPDATE USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.transaction_lines tl WHERE tl.transaction_id = public.transactions.id AND public.can_write_account(tl.account_id)
  )
) WITH CHECK (created_by = auth.uid());
CREATE POLICY transactions_delete_access ON public.transactions FOR DELETE USING (created_by = auth.uid());

CREATE POLICY tx_lines_select_member ON public.transaction_lines FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY tx_lines_insert_writer ON public.transaction_lines FOR INSERT WITH CHECK (created_by = auth.uid() AND public.can_write_account(account_id));
CREATE POLICY tx_lines_update_writer ON public.transaction_lines FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY tx_lines_delete_writer ON public.transaction_lines FOR DELETE USING (public.can_write_account(account_id));

CREATE POLICY tx_tags_select_own ON public.transaction_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);
CREATE POLICY tx_tags_insert_own ON public.transaction_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);
CREATE POLICY tx_tags_delete_own ON public.transaction_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);

CREATE POLICY exchange_rates_select_all ON public.exchange_rates FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY exchange_rates_insert_manual ON public.exchange_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND source = 'manual');

CREATE POLICY checklist_select_own ON public.onboarding_checklist FOR SELECT USING (user_id = auth.uid());
CREATE POLICY checklist_insert_own ON public.onboarding_checklist FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY checklist_update_own ON public.onboarding_checklist FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_days_select_own ON public.activity_days FOR SELECT USING (user_id = auth.uid());
CREATE POLICY activity_days_insert_own ON public.activity_days FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY activity_days_update_own ON public.activity_days FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY push_sub_select_own ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_sub_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY push_sub_update_own ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_sub_delete_own ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());

CREATE POLICY audit_log_select_actor ON public.audit_log FOR SELECT USING (actor_user_id = auth.uid());

