
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); rec public.players; amt numeric(14,2);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  amt := (ARRAY[10,20,20,30,50,50,75,100])[floor(random()*8)::int + 1];

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
  ELSIF _key = 'play_5' THEN _reward := 25; _ok := _rounds >= 5;
  ELSIF _key = 'wager_200' THEN _reward := 20; _ok := _wagered >= 200;
  ELSIF _key = 'win_2' THEN _reward := 30; _ok := _wins >= 2;
  ELSIF _key = 'big_win' THEN _reward := 40; _ok := _big >= 1;
  ELSIF _key = 'two_games' THEN _reward := 20; _ok := _games >= 2;
  ELSIF _key = 'three_games' THEN _reward := 30; _ok := _games >= 3;
  ELSIF _key = 'play_15' THEN _reward := 50; _ok := _rounds >= 15;
  ELSE RAISE EXCEPTION 'Unknown quest';
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'Quest not completed yet'; END IF;

  INSERT INTO public.quest_claims (player_id, quest_key, reward, quest_date)
  VALUES (_uid, _key, _reward, _today);

  UPDATE public.players SET balance = balance + _reward WHERE id = _uid RETURNING * INTO _me;
  RETURN _me;
END; $$;
