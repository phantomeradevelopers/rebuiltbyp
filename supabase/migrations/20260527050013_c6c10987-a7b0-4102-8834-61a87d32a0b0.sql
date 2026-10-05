ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS cardio_preference text,
  ADD COLUMN IF NOT EXISTS treadmill_access text,
  ADD COLUMN IF NOT EXISTS work_lat numeric,
  ADD COLUMN IF NOT EXISTS work_lng numeric,
  ADD COLUMN IF NOT EXISTS work_label text,
  ADD COLUMN IF NOT EXISTS work_geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_dog boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dog_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nature_preference text;

ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_cardio_preference_chk
    CHECK (cardio_preference IS NULL OR cardio_preference IN ('outdoor','treadmill','mix','none')),
  ADD CONSTRAINT user_profile_treadmill_access_chk
    CHECK (treadmill_access IS NULL OR treadmill_access IN ('home','gym','both')),
  ADD CONSTRAINT user_profile_nature_preference_chk
    CHECK (nature_preference IS NULL OR nature_preference IN ('loves_nature','neutral','prefers_urban'));