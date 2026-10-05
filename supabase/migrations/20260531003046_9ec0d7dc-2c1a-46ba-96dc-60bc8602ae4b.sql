CREATE TABLE public.exercise_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text UNIQUE NOT NULL,
  video_id text NOT NULL,
  title text,
  channel text,
  thumbnail_url text,
  view_count bigint,
  score numeric,
  resolved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_videos TO anon, authenticated;
GRANT ALL ON public.exercise_videos TO service_role;
ALTER TABLE public.exercise_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercise videos are public" ON public.exercise_videos FOR SELECT USING (true);
CREATE INDEX idx_exercise_videos_name ON public.exercise_videos(normalized_name);