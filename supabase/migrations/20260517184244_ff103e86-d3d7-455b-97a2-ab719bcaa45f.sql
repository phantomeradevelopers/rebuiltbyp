CREATE TABLE public.daily_training_mode (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  modality text NOT NULL,
  category text NOT NULL,
  equipment text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_training_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training mode self all"
ON public.daily_training_mode
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER daily_training_mode_touch_updated_at
BEFORE UPDATE ON public.daily_training_mode
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_daily_training_mode_user_date ON public.daily_training_mode (user_id, date DESC);