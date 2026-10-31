-- =====================================================================
-- Peachey update 2: friends.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after schema.sql. Your existing posts and codes are kept.
--
-- After this, you only see posts (and their photos, hearts and comments)
-- from yourself and your friends. Everyone can still see the member list
-- (names, bios and profile photos) so they can send friend requests.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Friendships: one row per pair. 'pending' until the other person accepts.
-- ---------------------------------------------------------------------

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
-- Only one row per pair, whichever direction it was sent in.
create unique index friendships_pair on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee on public.friendships (addressee_id);

alter table public.friendships enable row level security;
create policy "see your own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
-- No insert/update/delete policies: changes go through the functions below.

-- Who made each invite code; using it makes you friends with them.
alter table public.invite_codes
  add column created_by uuid references public.profiles (id) on delete set null;
update public.invite_codes
   set created_by = (select id from public.profiles where is_admin order by created_at limit 1)
 where created_by is null;

-- ---------------------------------------------------------------------
-- Helper checks
-- ---------------------------------------------------------------------

-- The ids of my accepted friends.
create function public.my_friend_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when requester_id = auth.uid() then addressee_id else requester_id end
    from friendships
   where status = 'accepted' and auth.uid() in (requester_id, addressee_id);
$$;

-- Can I see this person's posts? (Me, or an accepted friend.)
create function public.can_see_author(author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member()
     and (author = auth.uid() or author in (select public.my_friend_ids()));
$$;

-- Can I see this post?
create function public.can_see_post(post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts p where p.id = post and public.can_see_author(p.author_id));
$$;

-- ---------------------------------------------------------------------
-- Replace "members see everything" with "friends see each other's things"
-- ---------------------------------------------------------------------

drop policy "members read posts" on public.posts;
create policy "read your and friends' posts" on public.posts
  for select to authenticated using (public.can_see_author(author_id));

drop policy "members read hearts" on public.hearts;
create policy "read hearts on posts you can see" on public.hearts
  for select to authenticated using (public.can_see_post(post_id));
drop policy "heart as yourself" on public.hearts;
create policy "heart posts you can see" on public.hearts
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));

-- Everyone's comments are visible on a post you can see, friends or not.
drop policy "members read comments" on public.comments;
create policy "read comments on posts you can see" on public.comments
  for select to authenticated using (public.can_see_post(post_id));
drop policy "comment as yourself" on public.comments;
create policy "comment on posts you can see" on public.comments
  for insert to authenticated with check (author_id = auth.uid() and public.can_see_post(post_id));

-- Photos: profile photos are visible to all members (for the member list);
-- post photos only to you and your friends.
drop policy "members view photos" on storage.objects;
create policy "view profile photos and friends' photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos' and public.is_member() and (
      (storage.foldername(name))[2] = 'avatar'
      or (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (select f::text from public.my_friend_ids() as f)
    )
  );

-- ---------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------

-- My friends, for the home screen (same shape as before, friends only).
create or replace function public.friends_list()
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
  where public.is_member() and pr.id in (select public.my_friend_ids())
  order by (lp.created_at is not null
            and lp.created_at > coalesce(fv.last_viewed_at, '-infinity'::timestamptz)) desc,
           lp.created_at desc nulls last,
           pr.display_name;
$$;

-- Where I stand with someone: 'me', 'friends', 'sent' (I asked them),
-- 'received' (they asked me) or 'none'.
create function public.friendship_status(other uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when other = auth.uid() then 'me'
    else coalesce((
      select case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = auth.uid() then 'sent'
        else 'received'
      end
      from friendships f
      where least(f.requester_id, f.addressee_id) = least(auth.uid(), other)
        and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), other)
    ), 'none')
  end
  where public.is_member();
$$;

-- Everyone on Peachey except me, with where I stand with each.
-- Requests to me come first, then everyone else by name.
create function public.members_list()
returns table (id uuid, display_name text, bio text, avatar_path text, status text, requested_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, pr.bio, pr.avatar_path,
         public.friendship_status(pr.id),
         (select f.created_at from friendships f
           where f.status = 'pending' and f.requester_id = pr.id and f.addressee_id = auth.uid())
    from profiles pr
   where public.is_member() and pr.id <> auth.uid()
   order by (public.friendship_status(pr.id) = 'received') desc, pr.display_name;
$$;

-- Ask someone to be friends. If they've already asked me, this accepts.
create function public.send_friend_request(other uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  current text;
begin
  if not public.is_member() then raise exception 'Not a member'; end if;
  if other = auth.uid() then raise exception 'You can’t friend yourself'; end if;
  if not exists (select 1 from profiles where id = other) then raise exception 'That person isn’t on Peachey'; end if;
  current := public.friendship_status(other);
  if current = 'received' then
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = other and addressee_id = auth.uid();
    return 'friends';
  elsif current = 'none' then
    insert into friendships (requester_id, addressee_id) values (auth.uid(), other);
    return 'sent';
  end if;
  return current;
end;
$$;

-- Accept or decline a request someone sent me.
create function public.respond_friend_request(other uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = other and addressee_id = auth.uid() and status = 'pending';
    return public.friendship_status(other);
  end if;
  delete from friendships
   where requester_id = other and addressee_id = auth.uid() and status = 'pending';
  return 'none';
end;
$$;

-- Unfriend someone, or cancel a request I sent.
create function public.remove_friend(other uuid) returns text
language sql security definer set search_path = public as $$
  delete from friendships
   where least(requester_id, addressee_id) = least(auth.uid(), other)
     and greatest(requester_id, addressee_id) = greatest(auth.uid(), other);
  select 'none';
$$;

-- Who hearted a post (only for posts I can see).
create or replace function public.post_hearts(post uuid)
returns table (user_id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, pr.avatar_path
    from hearts h join profiles pr on pr.id = h.user_id
   where h.post_id = post and public.can_see_post(post)
   order by h.created_at;
$$;

-- Invite codes now remember who made them.
create or replace function public.create_invite_codes(how_many int default 10)
returns setof public.invite_codes
language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  new_code text;
  maker uuid;
  i int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can create invite codes';
  end if;
  maker := coalesce(auth.uid(), (select id from profiles where is_admin order by created_at limit 1));
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
    return query insert into invite_codes (code, created_by) values (new_code, maker) returning *;
  end loop;
end;
$$;

-- Joining with a code now also makes you friends with whoever made it.
create or replace function public.redeem_invite(invite_code text, name text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  first_member boolean;
  inviter uuid;
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
     set used_by = null, used_at = now()
   where code = upper(trim(invite_code)) and used_at is null
  returning created_by into inviter;
  if not found then
    raise exception 'That invite code isn''t valid or has already been used';
  end if;

  perform pg_advisory_xact_lock(42);
  first_member := not exists (select 1 from public.profiles);

  insert into public.profiles (id, display_name, is_admin)
  values (auth.uid(), left(trim(name), 40), first_member)
  returning * into me;

  update public.invite_codes set used_by = me.id where code = upper(trim(invite_code));

  if inviter is not null and inviter <> me.id then
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (inviter, me.id, 'accepted', now())
    on conflict do nothing;
  end if;
  return me;
end;
$$;

revoke execute on function public.my_friend_ids() from public, anon;
revoke execute on function public.can_see_author(uuid) from public, anon;
revoke execute on function public.can_see_post(uuid) from public, anon;
revoke execute on function public.friendship_status(uuid) from public, anon;
revoke execute on function public.members_list() from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.my_friend_ids() to authenticated;
grant execute on function public.can_see_author(uuid) to authenticated;
grant execute on function public.can_see_post(uuid) to authenticated;
grant execute on function public.friendship_status(uuid) to authenticated;
grant execute on function public.members_list() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

select 'Friends update installed' as result;
