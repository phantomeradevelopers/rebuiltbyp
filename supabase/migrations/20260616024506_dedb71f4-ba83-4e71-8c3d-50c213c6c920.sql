ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'men';
ALTER TABLE public.user_profile DROP CONSTRAINT IF EXISTS user_profile_track_check;
ALTER TABLE public.user_profile ADD CONSTRAINT user_profile_track_check CHECK (track IN ('men','angels'));