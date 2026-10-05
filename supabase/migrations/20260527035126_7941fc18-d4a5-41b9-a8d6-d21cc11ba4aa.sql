ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS reminder_time_midday_local time without time zone NOT NULL DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS reminder_time_evening_local time without time zone NOT NULL DEFAULT '12:00:00';

UPDATE public.user_profile
SET reminder_time_midday_local = (reminder_time_local + interval '3 hours')::time,
    reminder_time_evening_local = (reminder_time_local + interval '6 hours')::time;