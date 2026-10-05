INSERT INTO public.achievements (key, title, description, category, sort_order, icon, criteria, xp, rarity) VALUES
('anchor_first', 'First Anchor', 'Save your first daily anchor reflection.', 'spirit', 26, 'sparkles', '{"type":"anchor_count","threshold":1}'::jsonb, 10, 'bronze'),
('anchor_streak_7', 'Anchored Week', 'Reflect on the daily anchor 7 days in a row.', 'spirit', 27, 'sparkles', '{"type":"anchor_streak","threshold":7}'::jsonb, 25, 'silver'),
('anchor_count_30', 'Steady Soul', 'Save 30 anchor reflections.', 'spirit', 28, 'sparkles', '{"type":"anchor_count","threshold":30}'::jsonb, 50, 'gold')
ON CONFLICT (key) DO NOTHING;