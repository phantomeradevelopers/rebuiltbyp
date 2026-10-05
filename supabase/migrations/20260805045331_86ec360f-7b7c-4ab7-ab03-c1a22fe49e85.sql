CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_txn_uniq
  ON public.payment_transactions (provider, provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payment records" ON public.payment_transactions;
CREATE POLICY "Users can view their own payment records"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_purchase(_user_id uuid, _product_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payment_transactions
    WHERE user_id = _user_id
      AND product_key = _product_key
      AND status IN ('succeeded','paid','completed')
  );
$$;

REVOKE ALL ON FUNCTION public.has_purchase(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_purchase(uuid, text) TO authenticated, service_role;