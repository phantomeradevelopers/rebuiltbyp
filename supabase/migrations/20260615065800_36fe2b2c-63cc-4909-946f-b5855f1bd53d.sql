ALTER TABLE public.food_log ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Owner-only RLS on the meal-photos bucket
CREATE POLICY "meal-photos owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "meal-photos owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "meal-photos owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);