ALTER TABLE public.user_profile 
ADD COLUMN IF NOT EXISTS outdoor_difficulty text,
ADD COLUMN IF NOT EXISTS outdoor_loop_shape text DEFAULT 'loop';