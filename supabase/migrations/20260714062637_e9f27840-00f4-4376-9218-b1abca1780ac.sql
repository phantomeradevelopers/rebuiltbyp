DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-ending-reminder-hourly') THEN
    PERFORM cron.unschedule('trial-ending-reminder-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'trial-ending-reminder-hourly',
  '7 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/trial-ending-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZ3R5ZGFvZnNudWlodnR3cXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODk3NjQsImV4cCI6MjA5NDU2NTc2NH0.xnq8PNIPmT-RoKqCwqqIqWK6XMoGjxYkaLZSilbFiqg'
    ),
    body := '{}'::jsonb
  );
  $cron$
);