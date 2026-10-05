
-- Progress photos bucket (private; users access only their own folder)
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "progress photos self select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "progress photos self insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "progress photos self delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
