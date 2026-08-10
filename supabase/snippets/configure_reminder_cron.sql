-- Run after deploying send-reminders and setting CRON_SECRET as an Edge secret.
-- First add these two values in Dashboard -> Integrations -> Vault:
--   nutrilens_function_url = https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders
--   nutrilens_cron_secret  = the exact same random value as the CRON_SECRET Edge secret
-- Vault keeps them encrypted at rest; the scheduled command does not contain either value.
-- Supabase Cron evaluates this in UTC; the Edge Function handles Europe/Zagreb time and DST.

select cron.schedule(
  'nutrilens-fixed-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'nutrilens_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'nutrilens_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Optional weekly cleanup for delivery-deduplication records.
select cron.schedule(
  'nutrilens-notification-cleanup',
  '30 3 * * 0',
  $$ delete from public.notification_deliveries where scheduled_for < now() - interval '90 days'; $$
);
