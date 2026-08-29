CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deposit','withdraw')),
  amount numeric(14,2) NOT NULL,
  method text NOT NULL DEFAULT 'upi',
  note text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (player_id = auth.uid());

CREATE INDEX wallet_transactions_player_idx ON public.wallet_transactions (player_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.make_deposit(_amount numeric, _method text DEFAULT 'upi')
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); rec public.players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 1000 THEN RAISE EXCEPTION 'Minimum deposit is 1000 coins'; END IF;
  IF _amount > 500000 THEN RAISE EXCEPTION 'Maximum deposit is 500000 coins'; END IF;

  UPDATE public.players SET balance = balance + _amount WHERE id = uid RETURNING * INTO rec;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;

  INSERT INTO public.wallet_transactions (player_id, kind, amount, method, status)
  VALUES (uid, 'deposit', _amount, COALESCE(NULLIF(trim(_method), ''), 'upi'), 'completed');

  RETURN rec;
END; $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _method text DEFAULT 'upi', _note text DEFAULT NULL)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.players;
  me public.players;
  deposited numeric;
  withdrawn numeric;
  eligible numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 500 THEN RAISE EXCEPTION 'Minimum withdrawal is 500 coins'; END IF;

  SELECT * INTO me FROM public.players WHERE id = uid;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;

  SELECT COALESCE(sum(amount) FILTER (WHERE kind = 'deposit'), 0),
         COALESCE(sum(amount) FILTER (WHERE kind = 'withdraw' AND status <> 'rejected'), 0)
    INTO deposited, withdrawn
    FROM public.wallet_transactions WHERE player_id = uid;

  -- only real winnings (profit) plus deposits can leave the wallet;
  -- starting coins and bonuses are not withdrawable
  eligible := GREATEST(me.total_won - me.total_wagered, 0) + deposited - withdrawn;
  IF _amount > eligible THEN
    RAISE EXCEPTION 'You can only withdraw your winnings. Withdrawable now: %', GREATEST(eligible, 0);
  END IF;
  IF _amount > me.balance THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  UPDATE public.players SET balance = balance - _amount WHERE id = uid RETURNING * INTO rec;

  INSERT INTO public.wallet_transactions (player_id, kind, amount, method, note, status)
  VALUES (uid, 'withdraw', _amount, COALESCE(NULLIF(trim(_method), ''), 'upi'), _note, 'pending');

  RETURN rec;
END; $$;