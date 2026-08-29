DROP VIEW IF EXISTS public.recent_big_wins;

CREATE TABLE public.public_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  multiplier numeric(10,2) NOT NULL,
  masked_player text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX public_wins_created_idx ON public.public_wins (created_at DESC);

GRANT SELECT ON public.public_wins TO anon, authenticated;
GRANT ALL ON public.public_wins TO service_role;

ALTER TABLE public.public_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_wins_read_all" ON public.public_wins
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_public_win()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  IF NEW.multiplier < 2 THEN RETURN NEW; END IF;
  SELECT left(username, 3) || '***' INTO nm FROM public.players WHERE id = NEW.user_id;
  INSERT INTO public.public_wins (game_slug, multiplier, masked_player)
  VALUES (NEW.game_slug, NEW.multiplier, COALESCE(nm, 'Pla***'));
  DELETE FROM public.public_wins w
   WHERE w.id IN (
     SELECT id FROM public.public_wins ORDER BY created_at DESC OFFSET 30
   );
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.record_public_win() FROM public, anon, authenticated;

CREATE TRIGGER game_rounds_public_win
AFTER INSERT ON public.game_rounds
FOR EACH ROW EXECUTE FUNCTION public.record_public_win();

REVOKE ALL ON FUNCTION public.ensure_player(text) FROM anon;
REVOKE ALL ON FUNCTION public.play_round(text, numeric, numeric, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.claim_daily_bonus() FROM anon;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;