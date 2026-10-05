
ALTER TABLE public.user_medications
  ADD COLUMN IF NOT EXISTS supply_remaining numeric,
  ADD COLUMN IF NOT EXISTS supply_unit text,
  ADD COLUMN IF NOT EXISTS low_supply_threshold integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_decrement boolean NOT NULL DEFAULT true;
