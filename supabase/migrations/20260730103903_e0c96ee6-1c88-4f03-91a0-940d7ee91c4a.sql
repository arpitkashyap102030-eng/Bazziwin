-- PLAYERS
CREATE TABLE public.players (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 1000,
  total_wagered numeric(14,2) NOT NULL DEFAULT 0,
  total_won numeric(14,2) NOT NULL DEFAULT 0,
  last_bonus_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_select_own" ON public.players
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "players_insert_own" ON public.players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "players_update_own" ON public.players
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- GAME ROUNDS
CREATE TABLE public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug text NOT NULL,
  bet numeric(14,2) NOT NULL,
  payout numeric(14,2) NOT NULL DEFAULT 0,
  multiplier numeric(10,2) NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX game_rounds_user_created_idx ON public.game_rounds (user_id, created_at DESC);
CREATE INDEX game_rounds_mult_idx ON public.game_rounds (multiplier DESC, created_at DESC);

GRANT SELECT ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_rounds TO service_role;

ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rounds_select_own" ON public.game_rounds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- PUBLIC BIG WINS FEED (no PII beyond chosen username)
CREATE VIEW public.recent_big_wins
WITH (security_invoker = off) AS
  SELECT r.id, r.game_slug, r.multiplier, r.payout, r.created_at,
         left(p.username, 3) || '***' AS masked_player
  FROM public.game_rounds r
  JOIN public.players p ON p.id = r.user_id
  WHERE r.multiplier >= 2
  ORDER BY r.created_at DESC
  LIMIT 30;

GRANT SELECT ON public.recent_big_wins TO anon, authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER players_touch BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ENSURE PLAYER EXISTS
CREATE OR REPLACE FUNCTION public.ensure_player(_username text DEFAULT NULL)
RETURNS public.players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rec public.players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO rec FROM public.players WHERE id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.players (id, username)
    VALUES (uid, COALESCE(NULLIF(trim(_username), ''), 'Player' || substr(uid::text, 1, 6)))
    RETURNING * INTO rec;
  END IF;
  RETURN rec;
END; $$;

REVOKE ALL ON FUNCTION public.ensure_player(text) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_player(text) TO authenticated;

-- PLAY ROUND: atomic stake + payout + log
CREATE OR REPLACE FUNCTION public.play_round(
  _game_slug text,
  _bet numeric,
  _multiplier numeric,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS public.players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.players;
  pay numeric(14,2);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _bet IS NULL OR _bet <= 0 OR _bet > 100000 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  IF _multiplier IS NULL OR _multiplier < 0 OR _multiplier > 10000 THEN RAISE EXCEPTION 'Invalid multiplier'; END IF;

  pay := round(_bet * _multiplier, 2);

  UPDATE public.players
     SET balance = balance - _bet + pay,
         total_wagered = total_wagered + _bet,
         total_won = total_won + pay
   WHERE id = uid AND balance >= _bet
   RETURNING * INTO rec;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  INSERT INTO public.game_rounds (user_id, game_slug, bet, payout, multiplier, details)
  VALUES (uid, _game_slug, _bet, pay, _multiplier, COALESCE(_details, '{}'::jsonb));

  RETURN rec;
END; $$;

REVOKE ALL ON FUNCTION public.play_round(text, numeric, numeric, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.play_round(text, numeric, numeric, jsonb) TO authenticated;

-- DAILY BONUS
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS public.players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rec public.players; amt numeric(14,2);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  amt := (ARRAY[100,200,300,500,700,1000,1500,1700])[floor(random()*8)::int + 1];

  UPDATE public.players
     SET balance = balance + amt, last_bonus_at = now()
   WHERE id = uid
     AND (last_bonus_at IS NULL OR last_bonus_at < now() - interval '24 hours')
   RETURNING * INTO rec;

  IF NOT FOUND THEN RAISE EXCEPTION 'Bonus already claimed today'; END IF;

  INSERT INTO public.game_rounds (user_id, game_slug, bet, payout, multiplier, details)
  VALUES (uid, 'daily-bonus', 0, amt, 0, jsonb_build_object('bonus', amt));

  RETURN rec;
END; $$;

REVOKE ALL ON FUNCTION public.claim_daily_bonus() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;