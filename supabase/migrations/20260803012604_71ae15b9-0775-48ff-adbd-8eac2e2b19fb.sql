ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.players(id),
  ADD COLUMN IF NOT EXISTS referral_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  quest_key text NOT NULL,
  reward numeric NOT NULL DEFAULT 0,
  quest_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, quest_key, quest_date)
);

GRANT SELECT, INSERT ON public.quest_claims TO authenticated;
GRANT ALL ON public.quest_claims TO service_role;

ALTER TABLE public.quest_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own quest claims"
  ON public.quest_claims FOR SELECT TO authenticated
  USING (player_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT referral_code INTO _code FROM public.players WHERE id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;

  LOOP
    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    BEGIN
      UPDATE public.players SET referral_code = _code WHERE id = _uid;
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _me public.players;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _me FROM public.players WHERE id = _uid;
  IF _me.id IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF _me.referred_by IS NOT NULL THEN RAISE EXCEPTION 'Invite bonus already claimed'; END IF;

  SELECT id INTO _owner FROM public.players WHERE referral_code = upper(trim(_code));
  IF _owner IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF _owner = _uid THEN RAISE EXCEPTION 'You cannot use your own code'; END IF;

  UPDATE public.players
     SET balance = balance + 100, referred_by = _owner
   WHERE id = _uid
   RETURNING * INTO _me;

  UPDATE public.players
     SET balance = balance + 50, referral_count = referral_count + 1
   WHERE id = _owner;

  RETURN _me;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quest(_key text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reward numeric := 0;
  _ok boolean := false;
  _rounds integer;
  _wagered numeric;
  _big integer;
  _games integer;
  _me public.players;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT count(*), coalesce(sum(bet), 0),
         count(*) FILTER (WHERE multiplier >= 3),
         count(DISTINCT game_slug)
    INTO _rounds, _wagered, _big, _games
    FROM public.game_rounds
   WHERE player_id = _uid
     AND (created_at AT TIME ZONE 'utc')::date = _today;

  IF _key = 'check_in' THEN _reward := 50; _ok := true;
  ELSIF _key = 'play_5' THEN _reward := 100; _ok := _rounds >= 5;
  ELSIF _key = 'wager_500' THEN _reward := 150; _ok := _wagered >= 500;
  ELSIF _key = 'big_win' THEN _reward := 200; _ok := _big >= 1;
  ELSIF _key = 'three_games' THEN _reward := 150; _ok := _games >= 3;
  ELSIF _key = 'play_20' THEN _reward := 300; _ok := _rounds >= 20;
  ELSE RAISE EXCEPTION 'Unknown quest';
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'Quest not completed yet'; END IF;

  INSERT INTO public.quest_claims (player_id, quest_key, reward, quest_date)
  VALUES (_uid, _key, _reward, _today);

  UPDATE public.players SET balance = balance + _reward WHERE id = _uid RETURNING * INTO _me;
  RETURN _me;
END;
$$;