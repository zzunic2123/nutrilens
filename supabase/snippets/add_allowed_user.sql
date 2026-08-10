-- Run once per invited friend in the Supabase SQL editor.
-- Always use a lowercase email address.
insert into public.allowed_users (email)
values ('friend@example.com')
on conflict (email) do nothing;
