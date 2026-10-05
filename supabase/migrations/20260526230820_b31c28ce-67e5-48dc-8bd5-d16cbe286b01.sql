
-- 1. user_profile: referral + vacation columns
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS vacation_until date,
  ADD COLUMN IF NOT EXISTS vacation_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_profile_referred_by ON public.user_profile(referred_by);
CREATE INDEX IF NOT EXISTS idx_user_profile_referral_code ON public.user_profile(referral_code);

-- 2. referral code generator (6 chars, A-Z 2-9 to avoid 0/O/1/I)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profile WHERE referral_code = code);
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- 3. trigger: auto-assign referral_code on insert
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profile_assign_referral_code ON public.user_profile;
CREATE TRIGGER user_profile_assign_referral_code
  BEFORE INSERT ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.assign_referral_code();

-- 4. backfill existing rows
UPDATE public.user_profile
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- 5. seed referral + comeback trophies
INSERT INTO public.achievements (key, title, description, category, rarity, xp, criteria, sort_order, hidden)
VALUES
  ('referral_1',  'First Convert',     'Bring 1 brother into the fold.',           'community', 'bronze',   25,  '{"type":"referral_count","threshold":1}'::jsonb,  300, false),
  ('referral_3',  'Squad Forming',     '3 friends complete onboarding.',           'community', 'silver',   50,  '{"type":"referral_count","threshold":3}'::jsonb,  301, false),
  ('referral_5',  'Movement',          '5 friends start the work.',                'community', 'silver',   75,  '{"type":"referral_count","threshold":5}'::jsonb,  302, false),
  ('referral_10', 'Recruiter',         '10 men reborn through your invite.',       'community', 'gold',     150, '{"type":"referral_count","threshold":10}'::jsonb, 303, false),
  ('referral_25', 'Force Multiplier',  '25 conversions. You are the example.',     'community', 'gold',     300, '{"type":"referral_count","threshold":25}'::jsonb, 304, false),
  ('referral_50', 'Legacy Builder',    '50 lives changed. This is your legacy.',   'community', 'platinum', 750, '{"type":"referral_count","threshold":50}'::jsonb, 305, false),
  ('comeback_1',  'Back at It',        'Returned from vacation and checked in.',   'mindset',   'bronze',   20,  '{"type":"comeback","threshold":1}'::jsonb,        310, false)
ON CONFLICT (key) DO NOTHING;
