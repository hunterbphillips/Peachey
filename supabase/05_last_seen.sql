-- =====================================================================
-- Peachey update 5: "last seen" on friends' profiles.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after 04_activity.sql.
--
-- The app notes when each person last had Peachey open. Only that
-- person and their friends can read it, and anyone can switch it off in
-- Edit profile ("Show when I was last on").
-- =====================================================================

-- The switch in Edit profile. On by default.
alter table public.profiles add column show_last_seen boolean not null default true;
grant update (show_last_seen) on public.profiles to authenticated;

create table public.presence (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.presence enable row level security;
create policy "you and your friends see when you were last on" on public.presence
  for select to authenticated
  using (
    user_id = auth.uid()
    or (user_id in (select public.my_friend_ids())
        and (select show_last_seen from public.profiles where id = presence.user_id))
  );
-- No insert/update policies: the app records presence through touch_presence().

-- "I'm here." Called by the app while it's open; writes at most once a minute.
create function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  insert into presence (user_id, last_seen_at)
  select auth.uid(), now() where public.is_member()
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at
   where presence.last_seen_at < now() - interval '1 minute';
$$;

revoke execute on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

select 'Last seen installed' as result;
