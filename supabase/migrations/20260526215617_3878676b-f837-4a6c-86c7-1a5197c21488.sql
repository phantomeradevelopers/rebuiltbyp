UPDATE public.user_profile SET gender = NULL WHERE gender IS NOT NULL AND gender NOT IN ('male','female');
ALTER TABLE public.user_profile DROP CONSTRAINT IF EXISTS user_profile_gender_check;
ALTER TABLE public.user_profile ADD CONSTRAINT user_profile_gender_check CHECK (gender IS NULL OR gender IN ('male','female'));