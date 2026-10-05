-- 1) meal-photos: owner-scoped UPDATE (prevents cross-user overwrite paths)
CREATE POLICY "meal-photos owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'meal-photos' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'meal-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2) support_messages: replace WITH CHECK (true) with validated, ownership-aware rules
DROP POLICY IF EXISTS "Anyone can send a support message" ON public.support_messages;

CREATE POLICY "Validated support message insert"
ON public.support_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND source IN ('contact','app','email','other')
  AND length(btrim(body)) BETWEEN 10 AND 4000
  AND (name IS NULL OR length(btrim(name)) <= 120)
  AND (subject IS NULL OR length(btrim(subject)) <= 200)
  AND (email IS NULL OR (length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s.]+\.[^@\s]+$'))
  AND read_at IS NULL
);