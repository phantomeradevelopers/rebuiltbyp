ALTER TABLE public.outdoor_routes ADD COLUMN IF NOT EXISTS steps jsonb;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS outdoor_activity text;
ALTER TABLE public.user_profile ADD CONSTRAINT user_profile_outdoor_activity_check CHECK (outdoor_activity IS NULL OR outdoor_activity IN ('walk','jog'));