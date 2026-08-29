CREATE TABLE public.app_config (
  id int PRIMARY KEY DEFAULT 1,
  latest_version text NOT NULL DEFAULT '1.0.0',
  apk_url text NOT NULL DEFAULT '',
  release_notes text DEFAULT 'Minor bug fixes and performance improvements.',
  force_update boolean NOT NULL DEFAULT false,
  upi_id text NOT NULL DEFAULT '',
  upi_payee_name text NOT NULL DEFAULT '3CR Arcade',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_single_row CHECK (id = 1)
);

GRANT SELECT ON public.app_config TO anon;
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.app_config FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER app_config_touch BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_config (id, latest_version, apk_url, release_notes, force_update)
VALUES (1, '1.0.0', 'https://arcade-hub-verse.lovable.app/3cr-arcade.apk', 'First Release', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  utr text NOT NULL UNIQUE,
  method text NOT NULL DEFAULT 'upi',
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deposit_requests_amount_check CHECK (amount >= 1000 AND amount <= 500000),
  CONSTRAINT deposit_requests_utr_check CHECK (utr ~ '^[0-9]{12}$'),
  CONSTRAINT deposit_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own deposit requests" ON public.deposit_requests
FOR SELECT TO authenticated USING (player_id = auth.uid());

CREATE POLICY "Players create own deposit requests" ON public.deposit_requests
FOR INSERT TO authenticated WITH CHECK (player_id = auth.uid() AND status = 'pending');

CREATE TRIGGER deposit_requests_touch BEFORE UPDATE ON public.deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX deposit_requests_player_idx ON public.deposit_requests (player_id, created_at DESC);

ALTER TABLE public.players ALTER COLUMN balance SET DEFAULT 100;

CREATE OR REPLACE FUNCTION public.claim_quest(_key text)
 RETURNS players
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reward numeric := 0;
  _ok boolean := false;
  _rounds integer;
  _wagered numeric;
  _big integer;
  _games integer;
  _wins integer;
  _me public.players;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT count(*), coalesce(sum(bet), 0),
         count(*) FILTER (WHERE multiplier >= 3),
         count(DISTINCT game_slug),
         count(*) FILTER (WHERE payout > bet)
    INTO _rounds, _wagered, _big, _games, _wins
    FROM public.game_rounds
   WHERE user_id = _uid
     AND game_slug <> 'daily-bonus'
     AND (created_at AT TIME ZONE 'utc')::date = _today;

  IF _key = 'check_in' THEN _reward := 20; _ok := true;
  ELSIF _key = 'play_1' THEN _reward := 20; _ok := _rounds >= 1;
  ELSIF _key = 'two_games' THEN _reward := 20; _ok := _games >= 2;
  ELSIF _key = 'play_5' THEN _reward := 50; _ok := _rounds >= 5;
  ELSIF _key = 'wager_200' THEN _reward := 50; _ok := _wagered >= 200;
  ELSIF _key = 'win_2' THEN _reward := 50; _ok := _wins >= 2;
  ELSIF _key = 'three_games' THEN _reward := 50; _ok := _games >= 3;
  ELSIF _key = 'big_win' THEN _reward := 100; _ok := _big >= 1;
  ELSIF _key = 'play_15' THEN _reward := 100; _ok := _rounds >= 15;
  ELSE RAISE EXCEPTION 'Unknown quest';
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'Quest not completed yet'; END IF;

  INSERT INTO public.quest_claims (player_id, quest_key, reward, quest_date)
  VALUES (_uid, _key, _reward, _today);

  UPDATE public.players SET balance = balance + _reward WHERE id = _uid RETURNING * INTO _me;
  RETURN _me;
END; $function$;

CREATE OR REPLACE FUNCTION public.ensure_player(_username text DEFAULT NULL::text)
 RETURNS players
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); rec public.players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO rec FROM public.players WHERE id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.players (id, username, balance)
    VALUES (uid, COALESCE(NULLIF(trim(_username), ''), 'Player' || substr(uid::text, 1, 6)), 100)
    RETURNING * INTO rec;
  END IF;
  RETURN rec;
END; $function$;

CREATE OR REPLACE FUNCTION public.submit_deposit_utr(_amount numeric, _utr text)
 RETURNS deposit_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cleaned text := regexp_replace(coalesce(_utr, ''), '\s', '', 'g');
  rec public.deposit_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 1000 THEN RAISE EXCEPTION 'Minimum deposit is 1000'; END IF;
  IF cleaned !~ '^[0-9]{12}$' THEN RAISE EXCEPTION 'UTR must be exactly 12 digits'; END IF;
  IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE utr = cleaned) THEN
    RAISE EXCEPTION 'This UTR has already been submitted';
  END IF;

  INSERT INTO public.deposit_requests (player_id, amount, utr)
  VALUES (uid, _amount, cleaned)
  RETURNING * INTO rec;

  RETURN rec;
END; $function$;