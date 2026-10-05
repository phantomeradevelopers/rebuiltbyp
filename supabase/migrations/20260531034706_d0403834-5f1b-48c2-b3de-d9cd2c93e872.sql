
ALTER TABLE public.nutrition_suggestions
  ADD COLUMN IF NOT EXISTS menu_item text,
  ADD COLUMN IF NOT EXISTS order_lines text[],
  ADD COLUMN IF NOT EXISTS macros jsonb,
  ADD COLUMN IF NOT EXISTS why text;
