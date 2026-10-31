-- =====================================================================
-- Peaches: database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run on a brand-new project. It creates the tables,
-- the security rules, the photo bucket and your first 30 invite codes.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per member. Created only by redeeming an invite code.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio          text not null default '' check (char_length(bio) <= 160),
  avatar_path  text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.invite_codes (
  code       text primary key,
  created_at timestamptz not null default now(),
  used_by    uuid references public.profiles (id) on delete set null,
  used_at    timestamptz
);

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 2000),
  image_path text,
  link_url   text check (link_url is null or link_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  constraint post_not_empty check (char_length(body) > 0 or image_path is not null or link_url is not null)
);
create index posts_author_created on public.posts (author_id, created_at desc);

create table public.hearts (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index comments_post_created on public.comments (post_id, created_at);

-- When each member last opened each friend's feed (drives the "new" dot).
create table public.feed_views (
  viewer_id      uuid not null references public.profiles (id) on delete cascade,
  friend_id      uuid not null references public.profiles (id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (viewer_id, friend_id)
);

-- ---------------------------------------------------------------------
-- Helper checks (security definer so they can be used inside policies)
-- ---------------------------------------------------------------------

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- Row-level security: only members can see anything; you can only
-- change your own things.
-- ---------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.invite_codes enable row level security;
alter table public.posts        enable row level security;
alter table public.hearts       enable row level security;
alter table public.comments     enable row level security;
alter table public.feed_views   enable row level security;

-- profiles
create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member() or id = auth.uid());
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- No insert policy: profiles are only created by redeem_invite().
-- Stop members from making themselves admin.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;

-- invite codes: admins only
create policy "admins read invites" on public.invite_codes
  for select to authenticated using (public.is_admin());

-- posts
create policy "members read posts" on public.posts
  for select to authenticated using (public.is_member());
create policy "members write own posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid() and public.is_member());
create policy "edit own posts" on public.posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own posts" on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- hearts
create policy "members read hearts" on public.hearts
  for select to authenticated using (public.is_member());
create policy "heart as yourself" on public.hearts
  for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "unheart your own" on public.hearts
  for delete to authenticated using (user_id = auth.uid());

-- comments
create policy "members read comments" on public.comments
  for select to authenticated using (public.is_member());
create policy "comment as yourself" on public.comments
  for insert to authenticated with check (author_id = auth.uid() and public.is_member());
create policy "edit own comments" on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = auth.uid());

-- feed views: private to each person
create policy "own feed views" on public.feed_views
  for all to authenticated using (viewer_id = auth.uid()) with check (viewer_id = auth.uid());

-- Keep edit timestamps honest and stop authors being changed.
create function public.touch_edited() returns trigger
language plpgsql as $$
begin
  new.edited_at := now();
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_edited();
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_edited();

-- ---------------------------------------------------------------------
-- Post details: each post with heart/comment counts and whether I hearted.
-- security_invoker means the rules above still apply.
-- ---------------------------------------------------------------------

create view public.post_details with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.hearts h where h.post_id = p.id)::int   as heart_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comment_count,
  exists (select 1 from public.hearts h where h.post_id = p.id and h.user_id = auth.uid()) as hearted_by_me
from public.posts p;

-- ---------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------

-- Join Peaches with an invite code. The very first person to join
-- becomes the admin (that should be you, Hunter).
create function public.redeem_invite(invite_code text, name text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  first_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if found then
    return me;
  end if;
  if char_length(trim(coalesce(name, ''))) = 0 then
    raise exception 'Please enter your name';
  end if;

  update public.invite_codes
     set used_by = null, used_at = now()   -- claim it (profile not created yet)
   where code = upper(trim(invite_code)) and used_at is null;
  if not found then
    raise exception 'That invite code isn''t valid or has already been used';
  end if;

  perform pg_advisory_xact_lock(42);       -- so two first-signups can't both be admin
  first_member := not exists (select 1 from public.profiles);

  insert into public.profiles (id, display_name, is_admin)
  values (auth.uid(), left(trim(name), 40), first_member)
  returning * into me;

  update public.invite_codes set used_by = me.id where code = upper(trim(invite_code));
  return me;
end;
$$;

-- The friends list: everyone except me, with when they last posted,
-- a preview, and whether there's something I haven't seen.
create function public.friends_list()
returns table (
  id uuid, display_name text, bio text, avatar_path text,
  last_post_at timestamptz, last_post_preview text, post_count int, has_new boolean
)
language sql stable security definer set search_path = public as $$
  select
    pr.id, pr.display_name, pr.bio, pr.avatar_path,
    lp.created_at,
    case
      when lp.body <> '' then left(lp.body, 140)
      when lp.image_path is not null then '📷 Photo'
      else '🔗 Link'
    end,
    (select count(*) from posts p where p.author_id = pr.id)::int,
    lp.created_at is not null
      and lp.created_at > coalesce(fv.last_viewed_at, '-infinity'::timestamptz)
  from profiles pr
  left join lateral (
    select p.created_at, p.body, p.image_path from posts p
     where p.author_id = pr.id order by p.created_at desc limit 1
  ) lp on true
  left join feed_views fv on fv.viewer_id = auth.uid() and fv.friend_id = pr.id
  where public.is_member() and pr.id <> auth.uid()
  order by (lp.created_at is not null
            and lp.created_at > coalesce(fv.last_viewed_at, '-infinity'::timestamptz)) desc,
           lp.created_at desc nulls last,
           pr.display_name;
$$;

-- Record that I've just looked at a friend's feed.
create function public.mark_feed_viewed(friend uuid) returns void
language sql security definer set search_path = public as $$
  insert into feed_views (viewer_id, friend_id, last_viewed_at)
  select auth.uid(), friend, now()
   where public.is_member()
  on conflict (viewer_id, friend_id) do update set last_viewed_at = excluded.last_viewed_at;
$$;

-- Make new invite codes like PEACH-7KQM-3XWD (admins only).
create function public.create_invite_codes(how_many int default 10)
returns setof public.invite_codes
language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- no 0/O/1/I
  new_code text;
  i int;
begin
  -- auth.uid() is null when run from the SQL editor, which is allowed.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can create invite codes';
  end if;
  for i in 1 .. least(greatest(how_many, 1), 100) loop
    loop
      select 'PEACH-' ||
             string_agg(substr(alphabet, (get_byte(b, n) % 32) + 1, 1), '' order by n)
               filter (where n < 4) || '-' ||
             string_agg(substr(alphabet, (get_byte(b, n) % 32) + 1, 1), '' order by n)
               filter (where n >= 4)
        into new_code
        from (select gen_random_bytes(8) as b) r, generate_series(0, 7) n;
      exit when not exists (select 1 from invite_codes where code = new_code);
    end loop;
    return query insert into invite_codes (code) values (new_code) returning *;
  end loop;
end;
$$;

-- Who hearted a post (names for the little "hearted by" list).
create function public.post_hearts(post uuid)
returns table (user_id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, pr.avatar_path
    from hearts h join profiles pr on pr.id = h.user_id
   where h.post_id = post and public.is_member()
   order by h.created_at;
$$;

revoke execute on function public.create_invite_codes(int) from public, anon;
revoke execute on function public.redeem_invite(text, text) from public, anon;
revoke execute on function public.friends_list() from public, anon;
revoke execute on function public.mark_feed_viewed(uuid) from public, anon;
revoke execute on function public.post_hearts(uuid) from public, anon;
grant execute on function public.create_invite_codes(int) to authenticated;
grant execute on function public.redeem_invite(text, text) to authenticated;
grant execute on function public.friends_list() to authenticated;
grant execute on function public.mark_feed_viewed(uuid) to authenticated;
grant execute on function public.post_hearts(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Photo storage: a private bucket. Only members can view photos;
-- you can only upload into your own folder. 5 MB per file, images only.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "members view photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Your first 30 invite codes
-- ---------------------------------------------------------------------

select public.create_invite_codes(30);
