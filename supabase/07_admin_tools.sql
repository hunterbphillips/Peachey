-- =====================================================================
-- Peaches update 7: tools for looking after the group, without prying.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after 06_multiple_photos.sql.
--
--  • Anyone can report a post they can see. The admin sees only that
--    post (the reporter chose to bring it forward) and can delete it or
--    dismiss the report.
--  • The admin can remove someone from Peaches: their account, posts,
--    photos, comments and hearts are erased, without the admin seeing them.
--  • Anyone (except the admin) can delete their own account the same way.
-- Photos are removed through a short-lived cleanup list: the admin's app
-- can delete only the exact photos on that list, and nothing else.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);
alter table public.reports enable row level security;
-- No policies: reports are only reached through the functions below.

create function public.report_post(post uuid, note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_post(post) then raise exception 'That post isn’t available'; end if;
  if exists (select 1 from posts where id = post and author_id = auth.uid()) then
    raise exception 'You can’t report your own post';
  end if;
  insert into reports (post_id, reporter_id, note)
  values (post, auth.uid(), left(trim(coalesce(note, '')), 300))
  on conflict (post_id, reporter_id) do update set note = excluded.note, created_at = now();
end;
$$;

-- The admin's list of reports, with just the reported post's text.
create function public.admin_reports()
returns table (
  report_id uuid, post_id uuid, note text, reported_at timestamptz,
  reporter_id uuid, reporter_name text,
  author_id uuid, author_name text,
  body text, link_url text, photo_count int, posted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, p.id, r.note, r.created_at,
         rp.id, rp.display_name,
         a.id, a.display_name,
         p.body, p.link_url,
         greatest(coalesce(array_length(p.image_paths, 1), 0), case when p.image_path is null then 0 else 1 end),
         p.created_at
    from reports r
    join posts p on p.id = r.post_id
    join profiles rp on rp.id = r.reporter_id
    join profiles a on a.id = p.author_id
   where public.is_admin()
   order by r.created_at desc;
$$;

create function public.admin_dismiss_report(report uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do that'; end if;
  delete from reports where id = report;
end;
$$;

-- ---------------------------------------------------------------------
-- Photo cleanup list: the admin's app may delete exactly these files.
-- ---------------------------------------------------------------------
create table public.photo_cleanup (
  path      text primary key,
  queued_at timestamptz not null default now()
);
alter table public.photo_cleanup enable row level security;

create function public.is_queued_for_cleanup(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (select 1 from photo_cleanup where path = object_name);
$$;

-- (Removing a file through the app needs both of these.)
create policy "admin deletes queued photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_queued_for_cleanup(name));
create policy "admin reaches queued photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.is_queued_for_cleanup(name));

create function public.admin_clear_cleanup(paths text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do that'; end if;
  delete from photo_cleanup where path = any(paths)
     or queued_at < now() - interval '1 day';
end;
$$;

-- All the photo files belonging to some posts (and optionally a profile photo).
create function public.photo_paths_for(post_ids uuid[], extra text default null) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x) filter (where x is not null), '{}')
    from (
      select unnest(p.image_paths) as x from posts p where p.id = any(post_ids)
      union all select p.image_path from posts p where p.id = any(post_ids)
      union all select extra
    ) s;
$$;
revoke execute on function public.photo_paths_for(uuid[], text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin: delete a post (from a report). Returns its photo files to remove.
-- ---------------------------------------------------------------------
create function public.admin_delete_post(post uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  paths text[];
begin
  if not public.is_admin() then raise exception 'Only the admin can do that'; end if;
  paths := public.photo_paths_for(array[post]);
  insert into photo_cleanup (path) select unnest(paths) on conflict do nothing;
  delete from posts where id = post;
  return paths;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: remove someone from Peaches. Returns their photo files to remove.
-- ---------------------------------------------------------------------
create function public.admin_remove_member(member uuid) returns text[]
language plpgsql security definer set search_path = public, auth as $$
declare
  paths text[];
begin
  if not public.is_admin() then raise exception 'Only the admin can do that'; end if;
  if member = auth.uid() then raise exception 'You can’t remove yourself'; end if;
  paths := public.photo_paths_for(
    (select coalesce(array_agg(id), '{}') from posts where author_id = member),
    (select avatar_path from profiles where id = member));
  insert into photo_cleanup (path) select unnest(paths) on conflict do nothing;
  delete from auth.users where id = member;   -- everything of theirs goes with it
  return paths;
end;
$$;

-- ---------------------------------------------------------------------
-- Delete my own account. The app removes my photo files first (I'm
-- allowed to delete my own), then calls this.
-- ---------------------------------------------------------------------
create function public.my_photo_paths() returns text[]
language sql stable security definer set search_path = public as $$
  select public.photo_paths_for(
    (select coalesce(array_agg(id), '{}') from posts where author_id = auth.uid()),
    (select avatar_path from profiles where id = auth.uid()));
$$;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.is_admin() then
    raise exception 'The admin account can’t be deleted from the app';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Activity: the admin also hears about new reports.
-- ---------------------------------------------------------------------
create or replace function public.my_activity()
returns table (
  kind text, actor_id uuid, actor_name text, actor_avatar_path text,
  post_id uuid, post_author_id uuid, post_author_name text,
  snippet text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id where public.is_member()),
  items as (
    -- hearts on my posts
    select 'heart_post' as kind, h.user_id as actor_id, p.id as post_id, p.author_id as post_author_id,
           coalesce(nullif(p.body, ''), case when p.image_path is not null or coalesce(array_length(p.image_paths, 1), 0) > 0 then 'your photo' else p.link_url end) as snippet,
           h.created_at
      from hearts h join posts p on p.id = h.post_id, me
     where p.author_id = me.id and h.user_id <> me.id
    union all
    -- comments on my posts
    select 'comment', c.author_id, p.id, p.author_id, c.body, c.created_at
      from comments c join posts p on p.id = c.post_id, me
     where p.author_id = me.id and c.author_id <> me.id
    union all
    -- hearts on my comments (only where I can still see the post)
    select 'heart_comment', ch.user_id, c.post_id, p.author_id, c.body, ch.created_at
      from comment_hearts ch join comments c on c.id = ch.comment_id join posts p on p.id = c.post_id, me
     where c.author_id = me.id and ch.user_id <> me.id and public.can_see_post(p.id)
    union all
    -- later comments on others' posts I've joined in on
    select 'thread_comment', c.author_id, p.id, p.author_id, c.body, c.created_at
      from comments c join posts p on p.id = c.post_id, me
     where p.author_id <> me.id and c.author_id <> me.id
       and public.can_see_post(p.id)
       and c.created_at > (select min(mine.created_at) from comments mine
                            where mine.post_id = p.id and mine.author_id = me.id)
    union all
    -- friend requests waiting for me
    select 'friend_request', f.requester_id, null, null, null, f.created_at
      from friendships f, me
     where f.addressee_id = me.id and f.status = 'pending'
    union all
    -- my requests that were accepted, and people who joined with my code
    select case when exists (select 1 from invite_codes ic
                              where ic.created_by = f.requester_id and ic.used_by = f.addressee_id)
                then 'joined' else 'friend_accepted' end,
           f.addressee_id, null, null, null, f.accepted_at
      from friendships f, me
     where f.requester_id = me.id and f.status = 'accepted' and f.accepted_at is not null
    union all
    -- for the admin: posts friends have reported
    select 'report', r.reporter_id, r.post_id, p.author_id, nullif(r.note, ''), r.created_at
      from reports r join posts p on p.id = r.post_id, me
     where public.is_admin()
  )
  select i.kind, i.actor_id, a.display_name, a.avatar_path,
         i.post_id, i.post_author_id, pa.display_name,
         left(i.snippet, 140), i.created_at
    from items i
    join profiles a on a.id = i.actor_id
    left join profiles pa on pa.id = i.post_author_id
   order by i.created_at desc
   limit 60;
$$;

revoke execute on function public.report_post(uuid, text) from public, anon;
revoke execute on function public.admin_reports() from public, anon;
revoke execute on function public.admin_dismiss_report(uuid) from public, anon;
revoke execute on function public.admin_clear_cleanup(text[]) from public, anon;
revoke execute on function public.admin_delete_post(uuid) from public, anon;
revoke execute on function public.admin_remove_member(uuid) from public, anon;
revoke execute on function public.my_photo_paths() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.is_queued_for_cleanup(text) from public, anon;
grant execute on function public.report_post(uuid, text) to authenticated;
grant execute on function public.admin_reports() to authenticated;
grant execute on function public.admin_dismiss_report(uuid) to authenticated;
grant execute on function public.admin_clear_cleanup(text[]) to authenticated;
grant execute on function public.admin_delete_post(uuid) to authenticated;
grant execute on function public.admin_remove_member(uuid) to authenticated;
grant execute on function public.my_photo_paths() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_queued_for_cleanup(text) to authenticated;

select 'Admin tools installed' as result;
