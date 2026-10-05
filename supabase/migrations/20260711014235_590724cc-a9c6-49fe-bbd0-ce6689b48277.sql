UPDATE public.wearable_connections SET provider = 'google_fit' WHERE provider = 'fitbit';
UPDATE public.oauth_states SET provider = 'google_fit' WHERE provider = 'fitbit';
ALTER TABLE public.wearable_connections DROP CONSTRAINT IF EXISTS wearable_connections_provider_check;
ALTER TABLE public.wearable_connections ADD CONSTRAINT wearable_connections_provider_check CHECK (provider IN ('google_fit','oura','whoop','apple_health'));