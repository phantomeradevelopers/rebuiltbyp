-- Remove duplicate cron jobs (older 'rebuilt-*' set); keep the newer named set.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobname FROM cron.job WHERE jobname LIKE 'rebuilt-%' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;

-- Reschedule the surviving jobs with an Authorization: Bearer <CRON_SECRET> header.
-- Value is embedded here so pg_cron can send it without external secret access.
-- If the secret is rotated, this migration must be re-run with the new value.

SELECT cron.unschedule('meal-reminders-hourly');
SELECT cron.schedule(
  'meal-reminders-hourly',
  '5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/meal-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 79065242e3bf041a93a5092fe938ce528219ff83d366475c2ecf92e537eacaf2"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

SELECT cron.unschedule('reengagement-nudges-15min');
SELECT cron.schedule(
  'reengagement-nudges-15min',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/reengagement',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 79065242e3bf041a93a5092fe938ce528219ff83d366475c2ecf92e537eacaf2"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

SELECT cron.unschedule('medication-reminders-5m');
SELECT cron.schedule(
  'medication-reminders-5m',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/medication-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 79065242e3bf041a93a5092fe938ce528219ff83d366475c2ecf92e537eacaf2"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

SELECT cron.unschedule('morning-checkin-nudge-5m');
SELECT cron.schedule(
  'morning-checkin-nudge-5m',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/morning-checkin-nudge',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 79065242e3bf041a93a5092fe938ce528219ff83d366475c2ecf92e537eacaf2"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);

-- daily-enqueue keeps hourly cadence
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('daily-enqueue-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
SELECT cron.schedule(
  'daily-enqueue-hourly',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7.lovable.app/api/public/hooks/daily-enqueue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 79065242e3bf041a93a5092fe938ce528219ff83d366475c2ecf92e537eacaf2"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);